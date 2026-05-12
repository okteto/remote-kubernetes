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

interface ComposeServiceShape {
    volumes?: unknown[];
}

interface DevServiceShape {
    workdir?: unknown;
    sync?: unknown[];
    remote?: unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asComposeService(value: unknown): ComposeServiceShape {
    if (!isObject(value)) {
        return {};
    }
    return {
        volumes: Array.isArray(value.volumes) ? value.volumes : undefined,
    };
}

function asDevService(value: unknown): DevServiceShape {
    if (!isObject(value)) {
        return {};
    }
    return {
        workdir: value.workdir,
        sync: Array.isArray(value.sync) ? value.sync : undefined,
        remote: value.remote,
    };
}

function getServicesMap(manifest: ManifestData): Record<string, unknown> | undefined {
    return isObject(manifest.services) ? manifest.services : undefined;
}

function getDevMap(manifest: ManifestData): Record<string, unknown> | undefined {
    return isObject(manifest.dev) ? manifest.dev : undefined;
}

function getTestMap(manifest: ManifestData): Record<string, unknown> | undefined {
    return isObject(manifest.test) ? manifest.test : undefined;
}

function getVolumesMap(manifest: ManifestData): Record<string, unknown> | undefined {
    return isObject(manifest.volumes) ? manifest.volumes : undefined;
}

function isDockerCompose(manifest: ManifestData): boolean {
    const services = getServicesMap(manifest);
    return services !== undefined && Object.keys(services).length > 0;
}

function getComposeServices(manifest: ManifestData): Service[] {
    const services = getServicesMap(manifest);
    if (!services) {
        return [];
    }

    const declaredVolumes = new Set<string>();
    const volumes = getVolumesMap(manifest);
    if (volumes) {
        for (const name of Object.keys(volumes)) {
            declaredVolumes.add(name);
        }
    }

    const result: Service[] = [];
    for (const [name, raw] of Object.entries(services)) {
        const svc = asComposeService(raw);
        if (!svc.volumes || svc.volumes.length === 0) {
            continue;
        }

        for (const volume of svc.volumes) {
            const parts = String(volume).split(':');
            if (parts.length !== 2) {
                continue;
            }

            // Skip volume mounts that reference a declared named volume — those
            // aren't host-to-container sync mounts.
            if (declaredVolumes.has(parts[0])) {
                continue;
            }

            result.push(new Service(name, parts[1], 0));
        }
    }

    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
}

function isOktetoV2(manifest: ManifestData): boolean {
    return manifest.dev !== undefined
        || manifest.deploy !== undefined
        || manifest.build !== undefined
        || manifest.test !== undefined;
}

function getWorkdir(dev: DevServiceShape): string {
    if (typeof dev.workdir === 'string') {
        return dev.workdir;
    }

    if (dev.sync && dev.sync.length > 0) {
        const parts = String(dev.sync[0]).split(':');
        return parts[parts.length - 1];
    }

    return '';
}

function getPort(dev: DevServiceShape): number {
    return typeof dev.remote === 'number' ? dev.remote : 0;
}

function getV2Services(manifest: ManifestData): Service[] {
    const dev = getDevMap(manifest);
    if (!dev) {
        return [];
    }

    const result: Service[] = [];
    for (const [name, raw] of Object.entries(dev)) {
        const svc = asDevService(raw);
        result.push(new Service(name, getWorkdir(svc), getPort(svc)));
    }

    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
}

function getTests(manifest: ManifestData): Test[] {
    const tests = getTestMap(manifest);
    if (!tests) {
        return [];
    }
    return Object.keys(tests).map(name => new Test(name));
}

function parseV2Manifest(manifest: ManifestData): Manifest {
    return new Manifest(getV2Services(manifest), getTests(manifest));
}

function parseComposeManifest(manifest: ManifestData): Manifest {
    return new Manifest(getComposeServices(manifest), []);
}

/**
 * Parses an Okteto manifest from a YAML document.
 * Supports both v2 manifests and docker-compose files.
 * @param parsed - The parsed YAML document
 * @returns The parsed Manifest object
 */
export function parseManifest(parsed: yaml.Document.Parsed): Manifest  {
    const raw = parsed.toJSON() as unknown;
    if (!isObject(raw)) {
        getLogger().debug(`manifest root is not an object (got ${raw === null ? 'null' : typeof raw}); treating as empty manifest`);
        return new Manifest([], []);
    }
    const manifest = raw;

    if (isOktetoV2(manifest)) {
        return parseV2Manifest(manifest);
    } else if (isDockerCompose(manifest)) {
        return parseComposeManifest(manifest);
    } else {
        getLogger().debug(`manifest does not match any known shape (no dev/deploy/build/test and no services); treating as empty`);
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
