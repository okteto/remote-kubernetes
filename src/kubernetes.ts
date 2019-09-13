import * as k8s from '@kubernetes/client-node';

export function getCurrentNamespace(): string {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    const current = kc.getCurrentContext();
    const ctx = kc.getContextObject(current);
    const ns =  ctx ? ctx.namespace : '';
    return ns ? ns : '';
}