import {promises} from 'fs';
import * as yaml from 'yaml';
import * as vscode from 'vscode';

export class Service {
    constructor(public name: string, public workdir: string, public port: number) {}
}

export class Test {
    constructor(public name: string) {}
}

export class Manifest {
    constructor(public services: Array<Service>, public tests: Array<Test>) {}
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

function getComposeServices(manifest: any): Service[] {

    const volumes = new Map<string, boolean>();
    if (manifest.volumes) {
        for (const k in manifest.volumes) {
            volumes.set(k, true);
        }
    }

    const result = [];
    for (const k in manifest.services){
        const svc = manifest.services[k];
        if (svc.volumes && svc.volumes.length > 0) {
            for (const v of svc.volumes) {
                const s = v.split(':');
                
                if (s.length == 2) {
                    // if the volume is declared, it's not used for sync
                    if (!volumes.has(s[0])) {
                        result.push(new Service(k, s[1], 0));
                    }        
                }
            }
        }
    }

    result.sort((a, b) => { return a.name.localeCompare(b.name)});

    return result;
}

function isOktetoV2(manifest: any): boolean {
    if (manifest.dev) {
        return true;
    }

    if (manifest.deploy) {
        return true;
    }

    if (manifest.build) {
        return true;
    }

    if (manifest.test) {
        return true;
    }

    return false;
}

function getV2Services(manifest: any): Service[] {
    const result: Array<Service> = [];
    for (const k in manifest.dev) {
        const svc = manifest.dev[k];
        const workdir = getWorkdir(svc);
        const m = new Service(k, workdir, svc.remote);
        result.push(m);
    }

    result.sort((a, b) => { return a.name.localeCompare(b.name)});
        
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

function getTests(manifest :any): Array<Test> {
    const tests: Test[] = [];
    if (manifest.test){
        for (const t in manifest.test) {
            tests.push(new Test(t));
        }
    }

    return tests
}

function parseV2Manifest(manifest: any): Manifest {
    const services = getV2Services(manifest)
    const tests = getTests(manifest)
    return new Manifest(services, tests);
}

function parseComposeManifest(manifest: any): Manifest {
    const services = getComposeServices(manifest)
    return new Manifest(services, []);
}

export function parseManifest(parsed: yaml.Document.Parsed): Manifest  {
    const manifest = parsed.toJSON();

    if (isOktetoV2(manifest)) {
        return parseV2Manifest(manifest);
    } else if (isDockerCompose(manifest)) {
        return parseComposeManifest(manifest);
    } else {
        return new Manifest([],[]);
    }
}

export async function get(manifestPath: vscode.Uri): Promise<Manifest> {
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
    if (r.services.length == 0 && r.tests.length == 0) {
        throw new Error(`${manifestPath} is not a valid manifest`);
    }

    return r;
    
}