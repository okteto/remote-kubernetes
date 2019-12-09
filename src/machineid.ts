'use strict';

import {commandSync} from 'execa';
import {createHmac} from 'crypto';
import * as os from 'os';

function getCommand(): string {
  switch (os.platform()) {
    case 'darwin':
        return 'ioreg -rd1 -c IOPlatformExpertDevice';
    case 'win32':
        return `${getWin32RegBinPath()}\\REG.exe ` +
        'QUERY HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography ' +
        '/v MachineGuid';
    case 'linux':
        return '( cat /var/lib/dbus/machine-id /etc/machine-id 2> /dev/null || hostname ) | head -n 1 || :';
    case 'freebsd':
        return 'kenv -q smbios.system.uuid || sysctl -n kern.hostuuid';
    default:
        throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

function getWin32RegBinPath(): string {
  if(process.platform !== 'win32') {
    return '';
  }
  
  if( process.arch === 'ia32' && process.env.hasOwnProperty('PROCESSOR_ARCHITEW6432') ) {
    return '%windir%\\sysnative\\cmd.exe /c %windir%\\System32';
  }
  
  return '%windir%\\System32';
}

export function protect(): string {
  let result = commandSync(getCommand(), {encoding: 'utf8'});
  if (result.failed) {
    return "na";
  }

  let id = expose(result.stdout);
  return hash(id);
}

export function hash(id: string): string {
  return createHmac('sha256', id).update("okteto").digest('hex');
}

function expose(result: string): string {
    switch (os.platform()) {
        case 'darwin':
            return result
                .split('IOPlatformUUID')[1]
                .split('\n')[0].replace(/\=|\s+|\"/ig, '');
        case 'win32':
            return result
                .toString()
                .split('REG_SZ')[1]
                .replace(/\r+|\n+|\s+/ig, '');
        case 'linux':
            return result
                .toString()
                .replace(/\r+|\n+|\s+/ig, '');
        case 'freebsd':
            return result
                .toString()
                .replace(/\r+|\n+|\s+/ig, '');
        default:
            throw new Error(`Unsupported platform: ${process.platform}`);
    }
}