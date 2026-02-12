import {promises} from 'fs';
import * as yaml from 'yaml';
import * as vscode from 'vscode';
import { getLogger } from './logger';

/**
 * Represents a service in an Okteto manifest.
 */
export class Service {
    constructor(public name: string, public workdir: string, public port: number) {}
}

/**
 * Represents a test in an Okteto manifest.
 */
export class Test {
    constructor(public name: string) {}
}

/**
 * Represents a parsed Okteto manifest file.
 * Contains the list of services and tests defined in the manifest.
 */
export class Manifest {
    constructor(public services: Array<Service>, public tests: Array<Test>) {}
}

type ManifestData = Record<string, unknown>;

function isDockerCompose(manifest: ManifestData): boolean {
    if (manifest.services) {
        const s = manifest.services;
        for (const _key in s){
            return true;
        }
    }

    return false;
}

function getComposeServices(manifest: ManifestData): Service[] {

    const volumes = new Map<string, boolean>();
    if (manifest.volumes && typeof manifest.volumes === 'object') {
        for (const k in manifest.volumes as Record<string, unknown>) {
            volumes.set(k, true);
        }
    }

    const result = [];
    if (manifest.services && typeof manifest.services === 'object') {
        for (const k in manifest.services as Record<string, unknown>){
            const svc = (manifest.services as Record<string, any>)[k];
            if (svc.volumes && Array.isArray(svc.volumes) && svc.volumes.length > 0) {
                for (const v of svc.volumes) {
                    const s = String(v).split(':');

                    if (s.length === 2) {
                        // if the volume is declared, it's not used for sync
                        if (!volumes.has(s[0])) {
                            result.push(new Service(k, s[1], 0));
                        }
                    }
                }
            }
        }
    }

    result.sort((a, b) => { return a.name.localeCompare(b.name)});

    return result;
}

function isOktetoV2(manifest: ManifestData): boolean {
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

function getV2Services(manifest: ManifestData): Service[] {
    const result: Array<Service> = [];
    if (manifest.dev && typeof manifest.dev === 'object') {
        for (const k in manifest.dev as Record<string, unknown>) {
            const svc = (manifest.dev as Record<string, any>)[k];
            const workdir = getWorkdir(svc);
            const m = new Service(k, workdir, svc.remote);
            result.push(m);
        }
    }

    result.sort((a, b) => { return a.name.localeCompare(b.name)});

    return result;
}

function getWorkdir(devBlock: Record<string, any>): string {
    if (devBlock.workdir && typeof devBlock.workdir === 'string') {
        return devBlock.workdir;
    }

    if (devBlock.sync && Array.isArray(devBlock.sync) && devBlock.sync.length > 0) {
        const sync = String(devBlock.sync[0]);
        const w = sync.split(":");
        return w[w.length - 1];
    }

    return "";
}

function getTests(manifest: ManifestData): Array<Test> {
    const tests: Test[] = [];
    if (manifest.test && typeof manifest.test === 'object'){
        for (const t in manifest.test as Record<string, unknown>) {
            tests.push(new Test(t));
        }
    }

    return tests
}

function parseV2Manifest(manifest: ManifestData): Manifest {
    const services = getV2Services(manifest)
    const tests = getTests(manifest)
    return new Manifest(services, tests);
}

function parseComposeManifest(manifest: ManifestData): Manifest {
    const services = getComposeServices(manifest)
    return new Manifest(services, []);
}

/**
 * Parses an Okteto manifest from a YAML document.
 * Supports both v2 manifests and docker-compose files.
 * @param parsed - The parsed YAML document
 * @returns The parsed Manifest object
 */
export function parseManifest(parsed: yaml.Document.Parsed): Manifest  {
    const manifest = parsed.toJSON() as ManifestData;

    if (isOktetoV2(manifest)) {
        return parseV2Manifest(manifest);
    } else if (isDockerCompose(manifest)) {
        return parseComposeManifest(manifest);
    } else {
        return new Manifest([],[]);
    }
}

/**
 * Reads and parses an Okteto manifest from a file URI.
 * Validates the YAML syntax and manifest structure.
 * @param manifestPath - URI of the manifest file to read
 * @returns The parsed Manifest object
 * @throws Error if the file is not valid YAML or not a valid Okteto manifest
 */
export async function get(manifestPath: vscode.Uri): Promise<Manifest> {
    const data = await promises.readFile(manifestPath.fsPath, {encoding: 'utf8'});
    if (!data) {
        throw new Error(`${manifestPath} is not a valid Okteto manifest`);
    }

    const parsed = yaml.parseDocument(data);
    if (parsed.errors && parsed.errors.length > 0) {
        getLogger().error(`${manifestPath} is not a valid yaml file: ${parsed.errors.join(", ")}`);
        throw new Error(`${manifestPath} is not a valid yaml file`);
    }
    
    const r = parseManifest(parsed);
    if (r.services.length === 0 && r.tests.length === 0) {
        throw new Error(`${manifestPath} is not a valid manifest`);
    }

    return r;
    
}