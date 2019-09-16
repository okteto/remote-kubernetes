import * as fs from 'fs';
import * as execa from 'execa';
import * as home from 'user-home';
import * as path from 'path'
import * as commandExists from 'command-exists';
import * as vscode from 'vscode';
import * as os from 'os';
import { rejects } from 'assert';

const oktetoFolder = '.okteto'
const stateFile = 'okteto.state'

export const state = {
  starting: 'starting',
  provisioning: 'provisioning',
  startingSync: 'startingSync',
  synchronizing: 'synchronizing',
  activating: 'activating',
  ready: 'ready',
  unknown: 'unknown',
  failed: 'failed',
}

export function isInstalled(): boolean{
  return commandExists.sync(getBinary())
}

export function start(manifest: string, namespace: string, name: string): Promise<string> {
  console.log(`launching ${getBinary()} up -f ${manifest} --namespace ${namespace} --remote`);
  return new Promise<string>((resolve, reject) => {
    disposeTerminal();
    cleanState(namespace, name);
    const term = vscode.window.createTerminal({
      name: `okteto`,
      hideFromUser: false,
      env: {
        "OKTETO_AUTODEPLOY":"1",
      }
    });

    try{
      term.sendText(`${getBinary()} up -f ${manifest} --namespace ${namespace} --remote`, true);
    }catch(err) {
      reject(err);
    }
    resolve();
  });
}

export function down(manifest: string, namespace: string, name:string): Promise<string> {
  console.log(`launching okteto down -f ${manifest} --namespace ${namespace}`);
  disposeTerminal();
  return new Promise<string>((resolve, reject) => {
    execa(getBinary(), ['down', '-f', manifest, '--namespace', namespace]).then((value)=>{
      resolve();
    },
    (reason) => {
      reject(reason);
    });
  })
  
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
  return state.unknown
}

export function onFailed(namespace: string, name:string, callback: () => void){
  const id = setInterval(() =>{
    const c = getState(namespace, name)
    if (c == state.failed) {
      callback();
      clearInterval(id);
    }
  }, 1000)
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
    if (os.platform() == 'win32') {
      binary = 'okteto.exe'
    } else {
      binary = 'okteto'
    }
  }

  return binary;
}

function disposeTerminal(){
  vscode.window.terminals.forEach((t) => {
    if (t.name == `okteto`) {
      t.dispose()
    }
  });
}