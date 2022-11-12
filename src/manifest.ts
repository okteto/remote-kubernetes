import {promises} from 'fs';
import * as yaml from 'yaml';

export class Manifest {
    constructor(public name: string, public namespace: string, public workdir: string, public port: number) {}
}

export function isDockerCompose(manifest: any): boolean {
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

export function parseManifest(parsed: yaml.Document.Parsed): Manifest[] {
    const j = parsed.toJSON();
    
    if (isDockerCompose(j)) {
        return getComposeServices(j);
    } else if (isOktetoV2(j)) {
        const result: Array<Manifest> = [];
        Object.keys(j.dev).forEach(key => {
            const v = j.dev[key];
            const workdir = getWorkdir(v);
            const m = new Manifest(key, v.namespace, workdir, v.remote);
            
            result.push(m);
        })
        return result;
    } else {
        const m = new Manifest(j.name, j.namespace, j.workdir, j.remote);
        if (!m.name){
            throw new Error(`Invalid manifest`);
        }
        return [m];
    }
}

export async function getManifests(manifestPath: string): Promise<Manifest[]> {
    const data = await promises.readFile(manifestPath, {encoding: 'utf8'});
    if (!data) {
        throw new Error(`${manifestPath} is not a valid Okteto manifest`);
    }

    const parsed = yaml.parseDocument(data);
    if (parsed.errors && parsed.errors.length > 0) {
        console.error(`${manifestPath} is not a valid yaml file: ${parsed.errors.join(", ")}`);
        throw new Error(`${manifestPath} is not a valid yaml file`);
    }
    
    return parseManifest(parsed);
    
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