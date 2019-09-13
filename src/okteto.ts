import * as fs from 'fs';
import * as execa from 'execa';
import * as home from 'user-home';
import * as path from 'path'
import * as commandExists from 'command-exists';

const oktetoFolder = '.okteto'
const stateFile = 'okteto.state'
const binary = '/Users/ramiro/okteto/okteto/bin/okteto'

export const state = {
  provisioning: 'provisioning',
  startingSync: 'startingSync',
  synchronizing: 'synchronizing',
  activating: 'activating',
  ready: 'ready',
  unknown: 'unknown',
}


export function isInstalled(): boolean{
  return commandExists.sync(binary)
}

export function start(manifest: string, namespace: string): execa.ExecaChildProcess<string> {
  console.log(`launching ${binary} up -f ${manifest} --namespace ${namespace}`);
  return execa(binary, ['up', '-f', manifest, '--namespace', namespace], {
      env: {OKTETO_AUTODEPLOY: "1"},
  });
}

export function down(manifest: string, namespace: string): execa.ExecaChildProcess<string> {
  console.log(`launching okteto down -f ${manifest} --namespace ${namespace}`);
  return execa(binary, ['down', '-f', manifest, '--namespace', namespace]);
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