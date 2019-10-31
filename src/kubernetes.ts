import * as k8s from '@kubernetes/client-node';


export function getCurrentContext(): {context: string, namespace:string} | undefined {
    try{
        const kc = new k8s.KubeConfig();
        kc.loadFromDefault();
    
        const current = kc.getCurrentContext();
        const ctx = kc.getContextObject(current);
        const ns =  ctx ? ctx.namespace : '';
        return {
            context: current,
            namespace: ns ? ns : 'default',
        };
    } catch(err) {
        console.error(`failed to get the context: ${err}`);
        return undefined;
    }
}