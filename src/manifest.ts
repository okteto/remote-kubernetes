import {promises} from 'fs';
import * as yaml from 'yaml';

export class Manifest {
    constructor(public name: string, public namespace: string, public workdir: string, public port: number) {}
}

export function parseManifest(parsed: yaml.Document.Parsed): Manifest[] {
    const j = parsed.toJSON();
    const result: Array<Manifest> = [];

    if (j.dev) {
        Object.keys(j.dev).forEach(key => {
            const v = j.dev[key];
            const m = new Manifest(key, v.namespace, v.workdir, v.remote);
            result.push(m);
        })
    } else {
        const m = new Manifest(j.name, j.namespace, j.workdir, j.remote);
        if (!m.name){
            throw new Error(`Invalid manifest`);
        }
        result.push(m);
    }

    return result;
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