import {promises} from 'fs';
import * as yaml from 'yaml';
import * as path from 'path';
import * as vscode from 'vscode';

export async function getManifest(manifestPath: string): Promise<any> {
    const data = await promises.readFile(manifestPath, {encoding: 'utf8'});
    const doc = yaml.parseDocument(data).toJSON();
    return doc;
}

export function getDefaultLocation(): vscode.Uri | undefined{
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return undefined;
    }

    const p = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'okteto.yml');
    const loc = vscode.Uri.file(p);
    console.log(`default location: ${loc.fsPath.toString()}`);
    return loc;

}
