import * as fs from 'fs';
import * as yaml from 'yaml';
import * as path from 'path';

export function exists(manifestPath: string): boolean {
    return fs.existsSync(manifestPath);
}

export function getPath(currentFolder: string) {
    return path.join(currentFolder, 'okteto.yml');
}

export function getName(manifestPath: string): string {
    const c = fs.readFileSync(manifestPath, 'utf-8');
    const doc = yaml.parseDocument(c).toJSON();
    return doc.name;
}

export function create(name: string, port: number, manifestPath: string) {
    const m = {
        name: name,
        image: 'okteto/remote-ssh:dev',
        command: ['/usr/sbin/sshd', '-De', '-p', port],
        workdir: '/root/code',
        securityContext: {
            capabilities: {
                add: ['SYS_PTRACE']
            },
        },
        forward: [`${port}:${port}`]
    };

    const content = yaml.stringify(m);
    try{
        fs.writeFileSync(manifestPath, content, { flag: 'w' });
    }   catch (err) {
        console.error(err);
    }
};
