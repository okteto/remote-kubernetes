'use strict';

import * as fs from 'fs';
import * as execa from 'execa';
import * as home from 'user-home';
import * as path from 'path';
import * as commandExists from 'command-exists';
import * as vscode from 'vscode';
import * as os from 'os';
import * as download from 'download';
import * as semver from 'semver';

var titlecase = require('title-case');

const oktetoFolder = '.okteto';
const stateFile = 'okteto.state';
const minimum = '1.5.2';

export const terminalName = `okteto`;

export const state = {
  activating: 'activating',
  attaching: 'attaching',
  pulling: 'pulling',
  startingSync: 'startingSync',
  synchronizing: 'synchronizing',
  ready: 'ready',
  unknown: 'unknown',
  failed: 'failed',
};

export function needsInstall(): {install: boolean, upgrade: boolean}{
  if (!commandExists.sync(getBinary())) {
    return {install: true, upgrade: false};
  }
  
  if (needsUpgrade()) {
    return {install: true, upgrade: true};
  }

  return {install: false, upgrade: false};
}

export function needsUpgrade(): boolean{
  const binary = getBinary();
  const version =  getVersion(binary);
  if (version) {
    try{
      return semver.lt(version, minimum);
    }catch(err){
      console.log(`invalid version: ${err}`);
      return true;
    }
  }
  
  return false;
}

function getVersion(binary: string): string | undefined {
  const r = execa.commandSync(`${binary} version`);
  if (r.failed) {
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
  let destination = '';
  let chmod = true;

  switch(os.platform()){
    case 'win32':
      source = 'https://downloads.okteto.com/cli/okteto-Windows-x86_64';
      destination = String.raw`c:\windows\system32\okteto.exe`;
      chmod = false;
      break;
    case 'darwin':
      source = 'https://downloads.okteto.com/cli/okteto-Darwin-x86_64';
      destination = '/usr/local/bin/okteto';
      break;
    default:
        source = 'https://downloads.okteto.com/cli/okteto-Linux-x86_64';
        destination = '/usr/local/bin/okteto';
  }

  try {
    await downloadFile(source, destination);
    if (!chmod) {
      return;
    }
  
    const r = await execa.command(`chmod +x ${destination}`);
    if (r.failed) {
      throw new Error(`failed to set exec permissions; ${r.stdout}`);  
    }
  } catch(err) {
    throw new Error(`failed to download ${source}: ${err.Message}`);  
  }
}

async function downloadFile(source: string, destination: string) {
  return new Promise<void>((resolve, reject) => {
    const st = fs.createWriteStream(destination);
    st.on('finish', ()=> resolve);
    st.on('error', (err) => reject(err));
    download(source).pipe(st);
  });
}

export function start(manifest: string, namespace: string, name: string, port: number): Promise<string> {
  console.log(`launching ${getBinary()} up -f ${manifest} --namespace ${namespace} --remote ${port}`);
  return new Promise<string>((resolve, reject) => {
    disposeTerminal();
    cleanState(namespace, name);
    const term = vscode.window.createTerminal({
      name: terminalName,
      hideFromUser: false,
      cwd: path.dirname(manifest),
      env: {
        "OKTETO_AUTODEPLOY":"1",
        "OKTETO_ORIGIN":"vscode"
      }
    });

    try{
      term.sendText(`${getBinary()} up -f ${manifest} --namespace ${namespace} --remote ${port}`, true);
      resolve();
    }catch(err) {
      reject(err.message);
    }
  });
}

export function down(manifest: string, namespace: string, name:string): execa.ExecaChildProcess<string> {
  console.log(`launching okteto down -f ${manifest} --namespace ${namespace}`);
  disposeTerminal();
  return execa(getBinary(), ['down', '-f', manifest, '--namespace', namespace]);
}

export function getStateMessages(): Map<string, string> {
  const messages = new Map<string, string>();
  messages.set(state.activating, "Activating your development environment...");
  messages.set(state.attaching, "Attaching your persistent volume...");
  messages.set(state.pulling, "Pulling your image...");
  messages.set(state.startingSync, "Starting the file synchronization service...");
  messages.set(state.synchronizing, "Synchronizing your files...");
  messages.set(state.ready, "Your development environment is ready...");
  return messages;  
}

function getStateFile(namespace: string, name:string): string {
  return path.join(home, oktetoFolder, namespace, name, stateFile);
}

export function getState(namespace: string, name: string): string {
  const p = getStateFile(namespace, name);

  if (!fs.existsSync(p)) {
    // if it doesn't exist we just return the initial state
    return state.activating;
  }

  var c = state.activating;
  
  try {
    c = fs.readFileSync(p, 'utf-8');
  }catch(err) {
    console.error(`failed to open ${p}: ${err}`);
    return state.unknown;
  }

  switch(c) {
      case state.activating:
      case state.attaching:
      case state.pulling:
      case state.synchronizing:
      case state.ready:
      case state.failed:
        return c;
      default:
        console.error(`received unknown state: '${c}'`);
        return state.unknown;
  }
}

export function notifyIfFailed(namespace: string, name:string, callback: (m: string) => void){
  const id = setInterval(() => {
    const c = getState(namespace, name);
    if (c === state.failed) {
      callback(`Okteto: Up command failed`);
      clearInterval(id);
    }
  }, 1000);
}

export function cleanState(namespace: string, name:string) {
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
  if (!binary) {
    if (os.platform() === 'win32') {
      binary = 'okteto.exe';
    } else {
      binary = 'okteto';
    }
  }

  return binary;
}

function disposeTerminal(){
  vscode.window.terminals.forEach((t) => {
    if (t.name === terminalName) {
      t.dispose();
    }
  });
}

export function showTerminal(){
  vscode.window.terminals.forEach((t) => {
    if (t.name === terminalName) {
      t.show();
    }
  });
}

export function getOktetoId(): string | undefined {
  const tokenFile =  path.join(home, oktetoFolder, ".token.json");
  try {
    const c = fs.readFileSync(tokenFile, 'utf-8');
    const token = JSON.parse(c);
    return token.ID;
  }catch(err) {
    console.error(`failed to open ${tokenFile}: ${err}`);
  }

  return undefined;
}

export function getLanguages(): RuntimeItem[] {
  const items = new Array<RuntimeItem>();
  items.push(new RuntimeItem("Java", "Maven", "maven"));
  items.push(new RuntimeItem("Java", "Gradle", "gradle"));
  items.push(new RuntimeItem("Ruby", "", "ruby"));
  items.push(new RuntimeItem("Python", "", "python"));
  items.push(new RuntimeItem("Node", "", "javascript"));
  items.push(new RuntimeItem("Golang", "", "golang"));
  items.push(new RuntimeItem("C#", "", "csharp"));

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

export async function init(manifestPath: vscode.Uri, choice: string) {
  try{
    const r = await execa.command(`${getBinary()} init --overwrite --file=${manifestPath.fsPath}`, {
      cwd: path.dirname(manifestPath.fsPath),
      env: {
        "OKTETO_ORIGIN":"vscode",
        "OKTETO_LANGUAGE":choice
        } 
      });
    if (r.failed) {
      throw new Error(`okteto init failed: ${r.stdout}`);
    }
  } catch (err) {
    throw new Error(`okteto init failed: ${err}`);
  }
}

class RuntimeItem implements vscode.QuickPickItem {

	label: string;
	
	constructor(private l: string, public description: string, public value: string) {
		this.label = titlecase(l);
	}
}