import * as k8s from '@kubernetes/client-node';
import * as vscode from 'vscode';
import * as path from 'path';

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
    try{
        const kc = new k8s.KubeConfig();
        if (kubeconfig) {
            console.log(`loading kubeconfig from files: ${kubeconfig}`);
            const files = kubeconfig.split(path.delimiter);
            kc.loadFromFile(files[0]);
            for (let i = 1; i < files.length; i++) {
                const tmp = new k8s.KubeConfig();
                tmp.loadFromFile(files[i]);
                kc.mergeConfig(tmp);
            }
        } else {
            kc.loadFromDefault();
        }
        
        const current = kc.getCurrentContext();
        const ctx = kc.getContextObject(current);
        const ns =  ctx ? ctx.namespace : '';
        if (ns){
            return ns;
        }
        
        return 'default';
    } catch(err) {
        console.error(`failed to get the context: ${err}`);
        return 'default';
    }
}
