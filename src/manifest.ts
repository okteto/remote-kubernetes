import * as fs from 'fs';
import * as yaml from 'yaml';
import * as path from 'path';
import * as vscode from 'vscode';

export function exists(manifestPath: string): boolean {
    return fs.existsSync(manifestPath);
}

export function getName(manifestPath: string): string {
    const c = fs.readFileSync(manifestPath, 'utf-8');
    const doc = yaml.parseDocument(c).toJSON();
    return doc.name;
}

export function create(name: string, port: number, manifestPath: string) {
    const m = {
        name: name,
        image: 'okteto/remote-ssh:dev',
        command: ['/usr/sbin/sshd', '-De', '-p', port],
        workdir: '/root/code',
        securityContext: {
            capabilities: {
                add: ['SYS_PTRACE']
            },
        },
        forward: [`${port}:${port}`]
    };

    const content = yaml.stringify(m);
    try{
        fs.writeFileSync(manifestPath, content, { flag: 'w' });
    }   catch (err) {
        console.error(err);
    }
};

export function getDefaultLocation(): vscode.Uri | undefined{
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length == 0) {
        return undefined;
    }

    const p = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'okteto.yml');
    return vscode.Uri.file(p);

}
