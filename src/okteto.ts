'use strict';

import * as fs from 'fs';
import {promises} from 'fs';
import * as execa from 'execa';
import * as path from 'path';
import * as commandExists from 'command-exists';
import {protect} from './machineid';
import * as vscode from 'vscode';
import * as os from 'os';
import * as download from 'download';
import * as semver from 'semver';
import {pascalCase} from 'change-case';
import * as paths from './paths';
import { clearInterval, setInterval } from 'timers';


const oktetoFolder = '.okteto';
const stateFile = 'okteto.state';
const minimum = '1.9.4';
const terminalName = `okteto`;

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

const isActive = new Map();

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
    return {install: semver.lt(version, minimum), upgrade: true};
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
  const r = await execa.command(`${binary} version`);
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

export async function install() {
  let source = '';
  let chmod = true;

  switch(os.platform()){
    case 'win32':
      source = `https://github.com/okteto/okteto/releases/download/${minimum}/okteto.exe`;
      chmod = false;
      break;
    case 'darwin':
      source = `https://github.com/okteto/okteto/releases/download/${minimum}/okteto-Darwin-x86_64`;
      break;
    default:
        source = `https://github.com/okteto/okteto/releases/download/${minimum}/okteto-Linux-x86_64`;
  }

  const installPath = getInstallPath();
  const folder = path.dirname(installPath);
  const filename = path.basename(installPath);
  
  try {
    await promises.mkdir(path.dirname(folder), {mode: 0o700, recursive: true});
  } catch(err) {
    console.error(`failed to create dir: ${err.message}`);
  }

  try {
    await download(source, folder, {filename: filename});
  } catch(err) {
    console.error(`download fail: ${err}`);
    if (err.code === 'EBUSY'){
      throw new Error(`failed to install okteto, ${installPath} is in use`);
    }

    throw new Error(`failed to download ${source} into ${installPath}: ${err.message}`);
  }

  if (chmod) {
    try {
      await execa('chmod', ['a+x', installPath]);
    } catch(err) {
      throw new Error(`failed to chmod ${installPath}: ${err.message}`);
    }
  }

  try {
    const version = await getVersion(installPath);
    if (!version) {
      throw new Error(`${installPath} wasn't correctly installed`);
    }
  } catch(err) {
    throw err;
  }
}

export function up(manifest: string, namespace: string, name: string, port: number, kubeconfig: string) {
  console.log(`okteto up ${manifest}`);
  if (isActive.has(`${terminalName}-${namespace}-${name}`) && isActive.get(`${terminalName}-${namespace}-${name}`)) {
    disposeTerminal(`${namespace}-${name}`);
  }
  isActive.set(`${terminalName}-${namespace}-${name}`, false);
  cleanState(namespace, name);
  const term = vscode.window.createTerminal({
    name: `${terminalName}-${namespace}-${name}`,
    hideFromUser: false,
    cwd: path.dirname(manifest),
    env: {
      "OKTETO_AUTODEPLOY":"1",
      "OKTETO_ORIGIN":"vscode",
      "KUBECONFIG": kubeconfig,
    }
  });


  let binary = getBinary();
  if (gitBashMode()){
    console.log('using gitbash style paths');
    binary = paths.toGitBash(binary);
    manifest = paths.toGitBash(manifest);
  }

  isActive.set(`${terminalName}-${namespace}-${name}`, true);
  let cmd = `${binary} up -f '${manifest}' --remote '${port}'`;

  const config = vscode.workspace.getConfiguration('okteto');
  if (config) {
    const params = config.get<boolean>('upArgs') || '';
    cmd = `${cmd} ${params}`;
  }

  console.log(cmd);
  term.sendText(cmd, true);
}

export async function down(manifest: string, namespace: string, name: string, kubeconfig: string) {
  isActive.set(`${terminalName}-${namespace}-${name}`, false);
  disposeTerminal(`${namespace}-${name}`);
  
  const r =  execa(getBinary(), ['down', '--file', `${manifest}`, '--namespace', `${namespace}`], {
    env: {
      "KUBECONFIG": kubeconfig,
      "OKTETO_ORIGIN":"vscode"
    },
    cwd: path.dirname(manifest),
  });
  
  try{
    await r;
  } catch (err) {
    console.error(`${err}: ${err.stdout}`);
    const message = extractMessage(err.stdout);    
    throw new Error(message);
  }

  console.log('okteto down completed');
}

export async function init(manifestPath: vscode.Uri, choice: string) {
  const r = execa(getBinary(),['init', '--overwrite', '--file', `${manifestPath.fsPath}`], {
    cwd: path.dirname(manifestPath.fsPath),
    env: {
      "OKTETO_ORIGIN":"vscode",
      "OKTETO_LANGUAGE":choice
      }
    }); 
    
  try{
    await r;
  } catch (err) {
    console.error(`${err}: ${err.stdout}`);
    const message = extractMessage(err.stdout);
    throw new Error(message);
  }

  console.log('okteto init completed');
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

export async function getState(namespace: string, name: string): Promise<{state: string, message: string}> {
  const p = getStateFile(namespace, name);

  try{
    await promises.access(p);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.log(`failed to read state file: ${err}`);
    }

    return {state: state.starting, message: ""};
  }

  var c = '';

  try {
    const buffer = await promises.readFile(p, {encoding: 'utf8'});
    c = buffer.toString();
  } catch(err) {
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
  }catch(err) {
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

  return getInstallPath();
}

function getInstallPath(): string {
  if (os.platform() === 'win32') {
    return path.join(os.homedir(), "AppData", "Local", "Programs", "okteto.exe");
  }

  return path.join(os.homedir(), '.okteto-vscode', 'okteto');
}

function disposeTerminal(terminalNameSuffix: string){
  vscode.window.terminals.forEach((t) => {
    if (t.name === `${terminalName}-${terminalNameSuffix}`) {
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

export function getOktetoId(): {id: string, machineId: string} {
  const tokenFile =  path.join(os.homedir(), oktetoFolder, ".token.json");
  let oktetoId: string;
  let machineId: string;

  try {
    const c = fs.readFileSync(tokenFile, {encoding: 'utf8'});
    const token = JSON.parse(c);
    oktetoId = token.ID;
    machineId = token.MachineID;
  } catch(err) {
    console.error(`failed to open ${tokenFile}: ${err}`);
    oktetoId = "";
    machineId = "";
  }

  if (!machineId) {
    machineId = protect();

  }

  return {id: oktetoId, machineId: machineId};
}

export function getLanguages(): RuntimeItem[] {
  const items = new Array<RuntimeItem>();
  items.push(new RuntimeItem("Java", "Maven", "maven"));
  items.push(new RuntimeItem("Java", "Gradle", "gradle"));
  items.push(new RuntimeItem("Ruby", "", "ruby"));
  items.push(new RuntimeItem("Python", "", "python"));
  items.push(new RuntimeItem("Node", "", "javascript"));
  items.push(new RuntimeItem("Golang", "", "golang"));
  items.push(new RuntimeItem("CSharp", "", "csharp"));

  const sorted = items.sort((a, b)=>{
    if (a.label === b.label) {
      return 0;
    } else if (a.label > b.label) {
      return 1;
    } else {
      return -1;
    }
  });

  sorted.push(new RuntimeItem("Other", "", ""));
  return sorted;

}


class RuntimeItem implements vscode.QuickPickItem {

	label: string;

	constructor(private l: string, public description: string, public value: string) {
		this.label = pascalCase(l);
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
  const parts = error.split(':');
  let message = '';
  if (parts.length === 1) {
    message = parts[0];
  } else {
    message = parts[1];
  }

  message = message.replace('x  ', '');  
  return message;
}
