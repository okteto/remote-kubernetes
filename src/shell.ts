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

// this checks if the shell defined in the default profile is the cmd
export function isGitBash(): boolean {
    if (os.platform() !== "win32") {
        return false;
    }

    const config = vscode.workspace.getConfiguration('okteto');
    if (!config) {
      return false;
    }
  
    const r = config.get<boolean>('gitBash');
    if (r) {
        return r;
    }

    const winProfile = getDefaultProfileName();
    if (winProfile) {
        if (winProfile === "Git Bash") {
            return true;
        }
    
        const defaultProfile = getProfile(winProfile);
        if (defaultProfile && defaultProfile.path) {
            defaultProfile.path.forEach(p => {
                if (p && IS_GITBASH.test(p)) {
                    return true;
                }
            });
        }
    }
    
    return false;
}


// this checks if the shell defined in the default profile is the cmd
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
    
    // if there's no default profile, then it defaults to PowerShell
    return false;
}