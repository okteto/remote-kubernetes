'use strict';

import * as vscode from 'vscode';
import * as os from 'os';

const IS_GITBASH = /(gitbash.exe$)/i;
const IS_COMMAND = /(cmd.exe$|cmd$)/i;
//const IS_POWERSHELL = /(powershell.exe$|powershell$)/i;
//const IS_POWERSHELL_CORE = /(pwsh.exe$|pwsh$)/i;


function getTerminalShellPath(): string | undefined {
    const shellConfig = vscode.workspace.getConfiguration('terminal.integrated.shell');
    return shellConfig.get<string>(os.platform())!;    
}

export function isGitBash(): boolean {
    if (os.platform() !== "win32") {
        return false;
    }

    const sh = getTerminalShellPath()
    if (sh === undefined) {
        return false;
    }

    return IS_GITBASH.test(sh)
}

export function isWindowsCmd(): boolean {
    if (os.platform() !== "win32") {
        return false;
    }

    const sh = getTerminalShellPath()
    if (sh === undefined) {
        return false;
    }

    return IS_COMMAND.test(sh)
    
}