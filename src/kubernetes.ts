import * as k8s from '@kubernetes/client-node';


export function getCurrentContext(): {context: string, namespace:string} {
    try{
        const kc = new k8s.KubeConfig();
        kc.loadFromDefault();
    
        const current = kc.getCurrentContext();
        const ctx = kc.getContextObject(current);
        const ns =  ctx ? ctx.namespace : '';
        return {
            context: current,
            namespace: ns ? ns : '',
        }
    }catch(err) {
        console.error(`failed to get the context: ${err}`);
        return {
            context: '',
            namespace: ''
        }
    }
}