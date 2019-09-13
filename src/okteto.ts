import * as fs from 'fs';
import * as execa from 'execa';
import * as home from 'user-home';
import * as path from 'path'
import * as commandExists from 'command-exists';
import * as vscode from 'vscode';
import * as os from 'os';

const oktetoFolder = '.okteto'
const stateFile = 'okteto.state'

export const state = {
  provisioning: 'provisioning',
  startingSync: 'startingSync',
  synchronizing: 'synchronizing',
  activating: 'activating',
  ready: 'ready',
  unknown: 'unknown',
}


export function isInstalled(): boolean{
  return commandExists.sync(getBinary())
}

export function start(manifest: string, namespace: string): execa.ExecaChildProcess<string> {
  console.log(`launching ${getBinary()} up -f ${manifest} --namespace ${namespace}`);
  return execa(getBinary(), ['up', '-f', manifest, '--namespace', namespace], {
      env: {OKTETO_AUTODEPLOY: "1"},
  });
}

export function down(manifest: string, namespace: string): execa.ExecaChildProcess<string> {
  console.log(`launching okteto down -f ${manifest} --namespace ${namespace}`);
  return execa(getBinary(), ['down', '-f', manifest, '--namespace', namespace]);
}

export function getState(namespace: string, name: string): string {
  const p = path.join(home, oktetoFolder, namespace, name, stateFile);
  const c = fs.readFileSync(p, 'utf-8');
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
  }

  console.error(`received unknown state: ${c}`);
  return state.unknown
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