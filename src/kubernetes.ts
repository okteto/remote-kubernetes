import * as k8s from '@kubernetes/client-node';
import * as vscode from 'vscode';
import * as path from 'path';

const notFound = 'Kubeconfig not found';

export function getKubeconfig(): string {
    const k = vscode.workspace.getConfiguration('okteto').get<string>('kubeconfig');
    if (k) {
        return k;
    }

    const env = process.env.KUBECONFIG;
    if (env) {
        return env;
    }

    return '';
}

export function getCurrentNamespace(kubeconfig: string): string {
    var kc : k8s.KubeConfig;
    if (kubeconfig) {
        console.log(`loading kubeconfig from files: ${kubeconfig}`);
        try{
            kc = getFromFiles(kubeconfig);
        } catch(err) {
            console.error(`failed to read the configuration: ${err}`);
            throw new Error(`${kubeconfig} is not a valid kubernetes configuration file`);
        }
    } else {
        try{
            kc = getDefault();
        } catch(err) {
            console.error(`failed to read the default configuration: ${err}`);
            throw new Error(notFound);
        }
    }
    
    try{
        const current = kc.getCurrentContext();
        const ctx = kc.getContextObject(current);
        if (!ctx) {
            console.error(`fail to load context`);
            throw new Error(notFound);
        }
        
        const ns =  ctx.namespace ? ctx.namespace : '';
        if (ns){
            return ns;
        }

        if (ctx.cluster === 'cluster' && ctx.name === 'loaded-context' && ctx.user === 'user') {
            console.error(`empty kubeconfig ${ctx}`);
            throw new Error(notFound);
        }

        return 'default';
    } catch(err) {
        console.error(`failed to get the context: ${err}`);
        throw new Error(err.message);
    }
}

function getDefault() : k8s.KubeConfig {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    return kc;
}

function getFromFiles(file: string) : k8s.KubeConfig {
    const kc = new k8s.KubeConfig();
    const files = file.split(path.delimiter);
    kc.loadFromFile(files[0]);
    for (let i = 1; i < files.length; i++) {
        const tmp = new k8s.KubeConfig();
        tmp.loadFromFile(files[i]);
        kc.mergeConfig(tmp);
    }
    return kc;
}
