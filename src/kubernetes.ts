import * as k8s from '@kubernetes/client-node';
import * as vscode from 'vscode';

export function getKubeconfig(): string {
    const k = vscode.workspace.getConfiguration('okteto').get<string>('kubeconfig');
    if (k) {
        return k;
    }

    const env = process.env.KUBECONFIG;
    if (env) {
        return env;
    }

    return "";
}

export function getCurrentNamespace(kubeconfig: string): string {
    try{
        const kc = new k8s.KubeConfig();
        if (kubeconfig) {
            kc.loadFromFile(kubeconfig);
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