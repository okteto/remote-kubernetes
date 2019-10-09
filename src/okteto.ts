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
const minimum = '1.5.0';

export const terminalName = `okteto`;

export const state = {
  starting: 'starting',
  provisioning: 'provisioning',
  startingSync: 'startingSync',
  synchronizing: 'synchronizing',
  activating: 'activating',
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

export function install() {
 return new Promise<string>((resolve, reject) => {
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

    const st = fs.createWriteStream(destination);
    download(source).pipe(st);
    st.on('error', (err) =>{
      reject(err);
      return;
    }).on('finish', () =>{
      if (chmod) {
        console.log(`setting exec permissions`);
        const r = execa.commandSync(`chmod +x ${destination}`);
        if (r.failed) {
          reject(`chmod +x ${destination} failed: ${r.stderr}`);
        } else {
          resolve();
        }
      } else {
        resolve();
      }
    });
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
  messages.set(state.provisioning, "Provisioning your persistent volume...");
  messages.set(state.startingSync, "Starting the file synchronization service...");
  messages.set(state.synchronizing, "Synchronizing your files...");
  messages.set(state.activating, "Activating your Okteto Environment...");
  messages.set(state.ready, "Your Okteto Environment is ready...");
  return messages;  
}

function getStateFile(namespace: string, name:string): string {
  return path.join(home, oktetoFolder, namespace, name, stateFile);
}

export function getState(namespace: string, name: string): string {
  const p = getStateFile(namespace, name);

  if (!fs.existsSync(p)) {
    // if it doesn't exist we just return the initial state
    return state.provisioning;
  }

  var c = state.provisioning;
  
  try {
    c = fs.readFileSync(p, 'utf-8');
  }catch(err) {
    console.error(`failed to open ${p}: ${err}`);
  }

  switch(c) {
      case state.provisioning:
          return state.provisioning;
      case state.startingSync:
          return state.startingSync;
      case state.synchronizing:
          return state.synchronizing;
      case state.activating:
          return state.activating;
      case state.ready:
          return state.ready;
      case state.failed:
          return state.failed;
  }

  console.error(`received unknown state: '${c}'`);
  return state.unknown;
}

export function notifyIfFailed(namespace: string, name:string, callback: () => void){
  const id = setInterval(() => {
    const c = getState(namespace, name);
    if (c === state.failed) {
      callback();
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

export function init(manifestPath: vscode.Uri, choice: string): boolean {
  try{
    const r = execa.commandSync(`${getBinary()} init --overwrite --file=${manifestPath.fsPath}`, {
      cwd: path.dirname(manifestPath.fsPath),
      env: {
      "OKTETO_ORIGIN":"vscode",
      "OKTETO_LANGUAGE":choice
      } 
    });
    
    if (r.failed) {
      return false;
    }
  } catch (err) {
    console.error(`okteto init failed: ${err}`);
    return false;
  }

  return true;
}

class RuntimeItem implements vscode.QuickPickItem {

	label: string;
	
	constructor(private l: string, public description: string, public value: string) {
		this.label = titlecase(l);
	}
}