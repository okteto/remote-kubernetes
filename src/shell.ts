'use strict';

import * as vscode from 'vscode';
import * as os from 'os';

const IS_GITBASH = /(gitbash.exe$)/i;
const IS_COMMAND = /(cmd.exe$|cmd$)/i;
//const IS_POWERSHELL = /(powershell.exe$|powershell$)/i;
//const IS_POWERSHELL_CORE = /(pwsh.exe$|pwsh$)/i;


type vscodeProfile = {
    path: string[] | undefined,
}

function getDefaultProfileName(): string | undefined {
    const profile = vscode.workspace.getConfiguration('terminal.integrated.defaultProfile');
    const winProfile = profile.get<string>('windows');
    return winProfile;
}

function getProfile(name: string): vscodeProfile | undefined {
    const profiles = vscode.workspace.getConfiguration('terminal.integrated.profiles');
    const winProfiles = profiles.get<Map<string, vscodeProfile>>('windows');
    if (winProfiles === undefined) {
        return undefined;
    }

    return winProfiles.get(name);
}
// rules
// 1. check if there's a default profile
// 2. check terminal.external.windowsExec
// 3. assume powershell?
export function isWindowsCmd(): boolean {
    if (os.platform() !== "win32") {
        return false;
    }

    const winProfile = getDefaultProfileName();
    if (winProfile) {
        if (winProfile === "PowerShell") {
            return false;
        }
    
        if (winProfile === "Command Prompt") {
            return true;
        }

        const defaultProfile = getProfile(winProfile);
        if (defaultProfile && defaultProfile.path) {
            defaultProfile.path.forEach(p => {
                if (p && IS_COMMAND.test(p)) {
                    return true;
                }
            });
        }
    }
    
    const shellConfig = vscode.workspace.getConfiguration('terminal.external');
    const sh = shellConfig.get<string>('windowsExec');
    if (sh === undefined) {
        return false;
    }

    return IS_COMMAND.test(sh)
}