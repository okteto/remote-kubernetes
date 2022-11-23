import {promises} from 'fs';
import * as yaml from 'yaml';
import * as vscode from 'vscode';

export class Manifest {
    constructor(public name: string, public namespace: string, public workdir: string, public port: number) {}
}

function isDockerCompose(manifest: any): boolean {
    if (manifest.services) {
        const s = manifest.services;
        for (let $_ in s){
            return true;
        }
    }

    return false;
}

function getComposeServices(manifest: any): Manifest[] {

    var volumes = new Map<string, boolean>();
    if (manifest.volumes) {
        for (var k in manifest.volumes) {
            volumes.set(k, true);
        }
    }

    var result = [];
    for (let k in manifest.services){   
        const svc = manifest.services[k];
        if (svc.volumes && svc.volumes.length > 0) {
            for (var v of svc.volumes) {
                const s = v.split(':');
                
                if (s.length == 2) {
                    // if the volume is declared, it's not used for sync
                    if (!volumes.has(s[0])) {
                        result.push(new Manifest(k, '', s[1], 0));
                    }        
                }
            }
        }
    }

    return result;
}

function isOktetoV2(manifest: any): boolean {
    if (manifest.dev) {
        return true;
    }

    return false;
}

function isOktetoV1(manifest: any): boolean {
    if (manifest.name) {
        return true;
    }

    return false;
}

function getV2Services(manifest: any): Manifest[] {
    const result: Array<Manifest> = [];
    for (var k in manifest.dev) {
        const svc = manifest.dev[k];
        const workdir = getWorkdir(svc);
        const m = new Manifest(k, manifest.namespace, workdir, svc.remote);
        result.push(m);
    }
        
    return result;
}

function getWorkdir(devBlock :any): string {
    if (devBlock.workdir) {
        return devBlock.workdir;
    }

    if (devBlock.sync && devBlock.sync.length > 0) {
        const sync = devBlock.sync[0];
        const w = sync.split(":");
        return w[w.length - 1];
    }

    return "";
}

function getV1Service(manifest: any): Manifest[] {
    const m = new Manifest(manifest.name, manifest.namespace, manifest.workdir, manifest.remote);
        if (!m.name){
            throw new Error(`Invalid manifest`);
        }
        return [m];
}

export function parseManifest(parsed: yaml.Document.Parsed): Manifest[] {
    const manifest = parsed.toJSON();
    
    if (isOktetoV2(manifest)) {
        return getV2Services(manifest);
    } else if (isOktetoV1(manifest)) {
        return getV1Service(manifest)
    } else if (isDockerCompose(manifest)) {
        return getComposeServices(manifest);
    } else {
        return [];
    }
}

export async function getManifests(manifestPath: vscode.Uri): Promise<Manifest[]> {
    const data = await promises.readFile(manifestPath.fsPath, {encoding: 'utf8'});
    if (!data) {
        throw new Error(`${manifestPath} is not a valid Okteto manifest`);
    }

    const parsed = yaml.parseDocument(data);
    if (parsed.errors && parsed.errors.length > 0) {
        console.error(`${manifestPath} is not a valid yaml file: ${parsed.errors.join(", ")}`);
        throw new Error(`${manifestPath} is not a valid yaml file`);
    }
    
    const r = parseManifest(parsed);
    if (r.length == 0) {
        throw new Error(`${manifestPath} is not a valid manifest`);
    }

    return r;
    
}