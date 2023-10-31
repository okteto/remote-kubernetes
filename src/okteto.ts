'use strict';

import * as fs from 'fs';
import {promises} from 'fs';
import execa from 'execa';
import * as path from 'path';
import commandExists from 'command-exists';
import {protect} from './machineid';
import * as download from './download';
import * as vscode from 'vscode';
import * as os from 'os';
import * as semver from 'semver';
import * as paths from './paths';
import { clearInterval, setInterval } from 'timers';
import find from 'find-process';

const oktetoFolder = '.okteto';
const stateFile = 'okteto.state';
const pidFile = 'okteto.pid';
const contextFolder = 'context';
const contextFile = 'config.json';
const terminalName = 'okteto';
const cloudUrl = 'https://cloud.okteto.com';

export const state = {
  starting: 'starting',
  activating: 'activating',
  attaching: 'attaching',
  pulling: 'pulling',
  startingSync: 'startingSync',
  synchronizing: 'synchronizing',
  ready: 'ready',
  unknown: 'unknown',
  failed: 'failed',
};

export class Context {
  isOkteto: boolean = false;
  id: string = "";
  namespace: string = "";
  name: string = "";

  constructor(id: string, name: string, namespace: string, isOkteto: boolean) {
   this.id = id;
   this.isOkteto = isOkteto;
   this.name = name;
   this.namespace = namespace;
  }
}

const isActive = new Map<string, Boolean>();

export async function needsInstall(): Promise<{install: boolean, upgrade: boolean}>{
  const binary = getBinary();

  const installed = await isInstalled(binary);
  if (!installed) {
    return {install: true, upgrade: false};
  }


  try {
    const version =  await getVersion(binary);
    if (!version) {
      return {install: false, upgrade: false};
    }
    return {install: semver.lt(version, download.minimum), upgrade: true};
  } catch {
    return {install: false, upgrade: false};
  }
}

async function isInstalled(binaryPath: string): Promise<boolean> {
  try {
    if (path.isAbsolute(binaryPath)) {
      await promises.access(binaryPath);
    } else {
      await commandExists(binaryPath);
    }

    return true;
  } catch {
      return false;
  }
}

async function getVersion(binary: string): Promise<string | undefined> {
  const r = await execa(binary, ['version']);
  if (r.failed) {
    console.error(`okteto version failed: ${r.stdout} ${r.stderr}`);
    return undefined;
  }

  const version = r.stdout.replace('okteto version ', '').trim();
  if (semver.valid(version)) {
    return version;
  }

  return undefined;
}

export async function install(progress: vscode.Progress<{increment: number, message: string}>) {
  const source = download.getOktetoUrl();
  const installPath = download.getInstallPath();
  const folder = path.dirname(installPath);
  const filenameTemp = `${path.basename(installPath)}.temp`;
  const downloadPath = path.join(folder, filenameTemp);
  try {
    await promises.mkdir(path.dirname(folder), {mode: 0o700, recursive: true});
  } catch(err: any) {
    throw new Error(`failed to create dir: ${getErrorMessage(err)}`);
  }

  try {
    const r = await download.binary(source.url, downloadPath, progress);
  } catch(err: any) {
    console.error(`download fail: ${err}`);
    if (err.code === 'EBUSY'){
      throw new Error(`failed to install okteto, ${installPath} is in use`);
    }

    throw new Error(`failed to download ${source} into ${installPath}: ${getErrorMessage(err)}`);
  }

  try {
    if (fs.existsSync(installPath)) {
      fs.unlinkSync(installPath);
    }
  } catch(err: any) {
    console.error(`delete fail: ${err}`);
  }

  try {
    fs.renameSync(downloadPath, installPath);
  } catch(err: any) {
    console.error(`rename fail: ${err}`);
    throw new Error(`failed to download ${source} into ${installPath}: ${getErrorMessage(err)}`);
  }


  if (source.chmod) {
    try {
      await execa('chmod', ['a+x', installPath]);
    } catch(err: any) {
      throw new Error(`failed to chmod ${installPath}: ${getErrorMessage(err)}`);
    }
  }

  try {
    const version = await getVersion(installPath);
    if (!version) {
      throw new Error(`${installPath} wasn't correctly installed`);
    }
  } catch(err: any) {
    throw err;
  }
}

export function up(manifest: vscode.Uri, namespace: string, name: string, port: number, serviceName: string) {
  console.log(`okteto up ${manifest.fsPath}`);
  disposeTerminal(`${terminalName}-${namespace}-${name}`);
  isActive.set(`${terminalName}-${namespace}-${name}`, false);

  cleanState(namespace, name);
  const term = vscode.window.createTerminal({
    name: `${terminalName}-${namespace}-${name}`,
    hideFromUser: false,
    cwd: path.dirname(manifest.fsPath),
    env: {
      "OKTETO_ORIGIN":"vscode",
      "OKTETO_AUTOGENERATE_STIGNORE": "true",
    },
    message: "This terminal will be automatically closed when you run the okteto down command. Happy coding!",
    iconPath: new vscode.ThemeIcon('server-process')
  });


  let finalManifest = manifest.fsPath;
  let binary = getBinary();
  if (gitBashMode()){
    console.log('using gitbash style paths');
    binary = paths.toGitBash(binary);
    finalManifest = paths.toGitBash(manifest.fsPath);
  }

  isActive.set(`${terminalName}-${namespace}-${name}`, true);
  let cmd = `${binary} up ${serviceName} -f '${finalManifest}' --remote ${port}`;

  const config = vscode.workspace.getConfiguration('okteto');
  if (config) {
    const params = config.get<boolean>('upArgs') || '';
    cmd = `${cmd} ${params}`;
  }
  
  term.sendText(cmd, true);
}

export async function down(manifest: vscode.Uri, namespace: string, name: string, serviceName: string) {
  isActive.set(`${terminalName}-${namespace}-${name}`, false);
  disposeTerminal(`${terminalName}-${namespace}-${name}`);
  
  const r =  execa(getBinary(), ['down', serviceName, '--file', `${manifest.fsPath}`, '--namespace', `${namespace}`], {
    env: {
      "OKTETO_ORIGIN":"vscode"
    },
    cwd: path.dirname(manifest.fsPath),
  });
  
  try{
    await r;
  } catch (err: any) {
    console.error(`${err}: ${err.stdout}`);
    const message = extractMessage(err.stdout);    
    throw new Error(message);
  }

  console.log('okteto down completed');
}

export async function init(manifestPath: vscode.Uri) {    
  const name = `${terminalName}-init`;
  disposeTerminal(name);
  isActive.set(name, false);

  const term = vscode.window.createTerminal({
    name: name,
    hideFromUser: false,
    env: {
      "OKTETO_ORIGIN":"vscode",
    },
    iconPath: new vscode.ThemeIcon('server-process'),
    cwd: path.dirname(manifestPath.fsPath)
  });

  isActive.set(name, true);
  term.sendText(`${getBinary()} init --replace --file ${manifestPath.fsPath}`, true);
  term.show(false);
  console.log('okteto init completed');
}

export async function deploy(namespace: string, manifestPath: string) {
  const name = `${terminalName}-${namespace}-deploy`;
  disposeTerminal(name);
  isActive.set(name, false);

  const term = vscode.window.createTerminal({
    name: name,
    hideFromUser: false,
    env: {
      "OKTETO_ORIGIN":"vscode",
    },
    iconPath: new vscode.ThemeIcon('server-process')
  });

  isActive.set(name, true);
  term.sendText(`${getBinary()} deploy -f ${manifestPath} --wait`, true);
  term.show(true);
  console.log('okteto deploy completed');
}

export async function destroy(namespace: string, manifestUri: vscode.Uri) {
  const name = `${terminalName}-${namespace}-destroy`;
  disposeTerminal(name);
  isActive.set(name, false);

  const term = vscode.window.createTerminal({
    name: name,
    hideFromUser: false,
    env: {
      "OKTETO_ORIGIN":"vscode",
    },
    iconPath: new vscode.ThemeIcon('server-process')
  });

  isActive.set(name, true);
  term.sendText(`${getBinary()} destroy -f ${manifestUri.fsPath}`, true);
  term.show(true);
  console.log('okteto destroy completed');
}

export async function setContext(context: string) : Promise<boolean>{
  const name = `${terminalName}-context`;
  disposeTerminal(name);
  isActive.set(name, false);

  const term = vscode.window.createTerminal({
    name: name,
    hideFromUser: false,
    env: {
      "OKTETO_ORIGIN":"vscode",
    },
    iconPath: new vscode.ThemeIcon('server-process')
  });

  isActive.set(name, true);
  let cmd = `${getBinary()} context use ${context}`;
  term.sendText(cmd, true);
  
  return new Promise<boolean>(function(resolve, reject) {
    var timer = setTimeout(function () {
      reject(new Error('Context was not created, check your terminal for errors'));
    }, 5 * 60 * 1000);

    fs.watchFile(getContextConfigurationFile(), (curr, prev) => {
      const ctx = getContext();
      if (ctx.name === context) {
        clearTimeout(timer);
        disposeTerminal(name);
        resolve(true);
      }
    });
  });
}

export async function setNamespace(namespace: string) {
  const name = `${terminalName}-context`;
  disposeTerminal(name);
  isActive.set(name, false);

  const term = vscode.window.createTerminal({
    name: name,
    hideFromUser: false,
    env: {
      "OKTETO_ORIGIN":"vscode",
    },
    iconPath: new vscode.ThemeIcon('server-process')
  });

  isActive.set(name, true);
  let cmd = `${getBinary()} namespace use ${namespace}`;
  term.sendText(cmd, true);
  term.show(true);

  return new Promise<boolean>(function(resolve, reject) {
    var timer = setTimeout(function () {
      reject(new Error('Context was not created, check your terminal for errors'));
    }, 5 * 60 * 1000);

    fs.watchFile(getContextConfigurationFile(), (curr, prev) => {
      const ctx = getContext();
      if (ctx.namespace === namespace) {
        clearTimeout(timer);
        disposeTerminal(name);
        resolve(true);
        console.log('okteto namespace completed');console.log('okteto namespace completed');
      }
    });
  });
}


export function getStateMessages(): Map<string, string> {
  const messages = new Map<string, string>();
  messages.set(state.starting, "Starting your development environment...");
  messages.set(state.activating, "Activating your development environment...");
  messages.set(state.attaching, "Attaching your persistent volume...");
  messages.set(state.pulling, "Pulling your image...");
  messages.set(state.startingSync, "Starting the file synchronization service...");
  messages.set(state.synchronizing, "Synchronizing your files...");
  messages.set(state.ready, "Your development environment is ready...");
  return messages;
}

function getStateFile(namespace: string, name:string): string {
  return path.join(os.homedir(), oktetoFolder, namespace, name, stateFile);
}

function getPidFile(namespace: string, name:string): string {
  return path.join(os.homedir(), oktetoFolder, namespace, name, pidFile);
}

function getContextConfigurationFile(): string {
  return path.join(os.homedir(), oktetoFolder, contextFolder, contextFile);
}

export async function getState(namespace: string, name: string): Promise<{state: string, message: string}> {
  const p = getStateFile(namespace, name);

  try{
    await promises.access(p);
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      console.log(`failed to read state file: ${err}`);
    }

    return {state: state.starting, message: ""};
  }

  var c = '';

  try {
    const buffer = await promises.readFile(p, {encoding: 'utf8'});
    c = buffer.toString();
  } catch(err: any) {
    console.error(`failed to open ${p}: ${err}`);
    return {state: state.unknown, message: ""};
  }

  const st = splitStateError(c);

  switch(st.state) {
      case state.starting:
      case state.activating:
      case state.attaching:
      case state.pulling:
      case state.startingSync:
      case state.synchronizing:
      case state.ready:
      case state.failed:
        return st;
      default:
        console.error(`received unknown state: '${c}'`);
        return {state: state.unknown, message: ''};
  }
}

export async function isRunning(namespace: string, name: string): Promise<boolean> {
  const p = getPidFile(namespace, name);

  try{
    await promises.access(p);
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      console.error(`${p} doesn't exist`)
      return false;
    }
    
    console.error(`failed to open  pid file ${p}: ${err}`)
    return true;
  }

  var c = '';
  try {
    const buffer = await promises.readFile(p, {encoding: 'utf8'});
    c = buffer.toString();
  } catch(err: any) {
    console.error(`failed to open ${p}: ${err}`);
    return true;
  }

  const parsed = parseInt(c);
  if (isNaN(parsed)) { 
    console.error(`the content of ${p} is NaN: ${parsed}`)
    return true; 
  }
  
  try {
    const result = await find('pid', parsed);
    if (result.length == 0){
      console.log(`pid-${parsed} is not running`)
      return false;
    }

    console.log(`pid-${parsed} is running`)
    return true;
  } catch(err: any) {
    console.error(`failed to list processes: ${err}`);
    return true;
  }
}

function splitStateError(state: string): {state: string, message: string} {
  const splitted = state.split(':');

  const st = splitted.shift() || '';
  var msg = '';

  if (splitted.length > 0) {
    msg = splitted.join();
  }

  return {state: st, message: msg};
}

export async function notifyIfFailed(namespace: string, name:string, callback: (n: string, m: string) => void){
  const id = setInterval(async () => {
    const c = await getState(namespace, name);
    if (!isActive.has(`${terminalName}-${namespace}-${name}`) || !isActive.get(`${terminalName}-${namespace}-${name}`)) {
      clearInterval(id);
      return;
    }
    
    if (c.state === state.failed) {
      console.error(`okteto up failed: ${c.message}`);
      clearInterval(id);
      if (c.message) {
        callback(`${namespace}-${name}`, `Okteto: Up command failed: ${c.message}`);
      } else {
        callback(`${namespace}-${name}`, `Okteto: Up command failed`);
      }
    }

  }, 1000);
}

function cleanState(namespace: string, name:string) {
  const p = getStateFile(namespace, name);

  try{
    fs.unlinkSync(p);
  }catch(err: any) {
    if (err.code !== 'ENOENT'){
      console.error(`failed to delete ${p}: ${err}`);
    }
  }
}

function getBinary(): string {
  let binary = vscode.workspace.getConfiguration('okteto').get<string>('binary');
  if (binary) {
    if (binary.trim().length > 0) {
      return binary;
    }
  }

  return download.getInstallPath();
}

export function getRemoteSSH(): boolean {
  let remoteSSH = vscode.workspace.getConfiguration('okteto').get<boolean>('remoteSSH');
  if (remoteSSH === undefined) {
    return true;
  }

  return remoteSSH;
}



function disposeTerminal(terminalName: string){
  vscode.window.terminals.forEach((t) => {
    if (t.name === `${terminalName}`) {
      t.dispose();
    }
  });
}

export function showTerminal(terminalNameSuffix: string){
  vscode.window.terminals.forEach((t) => {
    if (t.name === `${terminalName}-${terminalNameSuffix}`) {
      t.show();
    }
  });
}

export function getContext(): Context {
  try {
    const c = fs.readFileSync(getContextConfigurationFile(), {encoding: 'utf8'});
    const contexts = JSON.parse(c);
    const current = contexts["current-context"];
    const ctx = contexts.contexts[current];
    if (ctx == null) {
      return new Context("", "", "", false);
    }

    return {id: ctx.id, name: ctx.name, namespace: ctx.namespace, isOkteto: ctx.isOkteto};
  } catch(err: any) {
    console.error(`failed to get current context from ${getContextConfigurationFile()}: ${err}`);
  }

  return new Context("", "", "", false);
}

export function getMachineId(): string {
  const analyticsFile =  path.join(os.homedir(), oktetoFolder,  "analytics.json");
  let machineId = "";
  try {
    const c = fs.readFileSync(analyticsFile, {encoding: 'utf8'});
    const token = JSON.parse(c);
    machineId = token.MachineID;
  } catch(err: any) {
    console.error(`failed to open ${analyticsFile}: ${err}`);
    machineId = "";
  }

  if (!machineId) {
    machineId = protect();
  }

  return machineId;
}

export async function getContextList(): Promise<RuntimeItem[]>{
  const items = new Array<RuntimeItem>();

  try {
    const r = await execa(getBinary(), ["context", "list", "--output", "json"])
    const lines = JSON.parse(r.stdout);
    for(var i = 0; i < lines.length; i++) {
      items.push(new RuntimeItem(lines[i].name, "", lines[i].name));
    }
  } catch(err: any) {
    console.error(`failed to get context list from ${getContextConfigurationFile()}: ${err}`);
  }

  if (items.filter(f => f.label === cloudUrl).length == 0) {
    items.unshift(new RuntimeItem(cloudUrl, "", cloudUrl))
  }

 
  items.push(new RuntimeItem("Create new context", "Create new context", "create"))
  return items;
}


class RuntimeItem implements vscode.QuickPickItem {

	label: string;

	constructor(private l: string, public description: string, public value: string) {
		this.label = l;
	}
}

function gitBashMode(): boolean {
  const config = vscode.workspace.getConfiguration('okteto');
  if (!config) {
    return false;
  }

  return config.get<boolean>('gitBash') || false;
}

function extractMessage(error :string):string {
  let message = error.replace('x  ', '');  
  message = message.replace('i  ', '');  
  return message;
}

function getErrorMessage(err: any): string {
  if (err instanceof Error) {
    return err.message;
  }

  return JSON.stringify(err);
}