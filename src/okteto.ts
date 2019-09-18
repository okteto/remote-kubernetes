import * as fs from 'fs';
import * as execa from 'execa';
import * as home from 'user-home';
import * as path from 'path';
import * as commandExists from 'command-exists';
import * as vscode from 'vscode';
import * as os from 'os';
import * as download from 'download';
import { TERMINAL } from './extension';

const oktetoFolder = '.okteto';
const stateFile = 'okteto.state';
const Terminal = `okteto`;

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

export function isInstalled(): boolean{
  return commandExists.sync(getBinary());
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
      name: TERMINAL,
      hideFromUser: false,
      cwd: path.dirname(manifest),
      env: {
        "OKTETO_AUTODEPLOY":"1",
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
    if (t.name === Terminal) {
      t.dispose();
    }
  });
}

export function showTerminal(){
  vscode.window.terminals.forEach((t) => {
    if (t.name === Terminal) {
      t.show();
    }
  });
}