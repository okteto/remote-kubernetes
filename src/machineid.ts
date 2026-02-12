'use strict';

import {execaSync} from 'execa';
import {createHmac} from 'crypto';
import * as os from 'os';
import { getLogger } from './logger';

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
  
  if( process.arch === 'ia32' && Object.prototype.hasOwnProperty.call(process.env, 'PROCESSOR_ARCHITEW6432') ) {
    return '%windir%\\sysnative\\cmd.exe /c %windir%\\System32';
  }
  
  return '%windir%\\System32';
}

/**
 * Gets a protected (hashed) machine ID for telemetry.
 * Executes platform-specific commands to retrieve a unique machine identifier,
 * then hashes it for anonymization.
 * @returns Anonymized machine identifier, or 'na' if retrieval fails
 */
export function protect(): string {
  try{
    const result = execaSync(getCommand(), {encoding: 'utf8'});
    if (result.failed) {
      return 'na';
    }

    const id = expose(result.stdout);
    return hash(id);
  }catch(err: unknown){
    getLogger().debug(`failed to generate machineid: ${err}`);
    return 'na';
  }
}

/**
 * Hashes a string using HMAC-SHA256 for anonymization.
 * Uses 'okteto' as the HMAC key for consistent hashing.
 * @param id - The string to hash
 * @returns The hashed value as a hex string
 */
export function hash(id: string): string {
  return createHmac('sha256', id).update("okteto").digest('hex');
}

function expose(result: string): string {
    switch (os.platform()) {
        case 'darwin':
            return result
                .split('IOPlatformUUID')[1]
                .split('\n')[0].replace(/=|\s+|"/ig, '');
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
