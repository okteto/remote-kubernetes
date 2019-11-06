import * as fs from 'fs';
import * as yaml from 'yaml';
import * as vscode from 'vscode';

import * as paths from './paths';

export function getName(manifestPath: string): Promise<string> {
    return new Promise<string>((resolve, reject)=>{
        fs.readFile(manifestPath, {encoding:'utf-8' }, (err, data)=>{
            if (err) {
                reject(err.message);
                return;
            }

            const doc = yaml.parseDocument(data).toJSON();
            resolve(doc.name);
        });
    });
    
    
}

export function getDefaultLocation(): vscode.Uri | undefined{
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return undefined;
    }

    const p = paths.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'okteto.yml');
    const loc = vscode.Uri.file(p);
    console.log(`default location: ${loc.fsPath.toString()}`);
    return loc;

}
