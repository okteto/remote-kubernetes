import * as ssh from 'ssh-config';
import * as fs from 'fs';
import * as home from 'user-home';
import * as path from 'path';

function getPath() : string {
    return path.join(home, ".ssh", "config");
}
function getConfig(): any {
    const configPath = getPath();
    let config = new ssh();
    if (fs.existsSync(configPath)){
        const c = fs.readFileSync(configPath, 'utf8');
        config = ssh.parse(c);
    }

    return config
}

function save(config: any) {
    const content = ssh.stringify(config);
    const configPath = getPath();
    fs.writeFileSync(configPath, content, { flag: 'w' });
}

export function removeConfig(name: string) {
    let config = getConfig();
    config.remove({ Host: name });
    save(config);
    console.log(`removed config for ${name}`);
}

export function updateConfig(name: string, port: number) {
    const configPath = path.join(home, ".ssh", "config");
    let config = new ssh();
    if (fs.existsSync(configPath)){
        const c = fs.readFileSync(configPath, 'utf8');
        config = ssh.parse(c);
    }
    
    config.remove({ Host: name });
    config.append({
        Host: name,
        HostName: 'localhost',
        User: 'root',
        Port: port,
        ForwardAgent: 'yes',
        StrictHostKeyChecking: 'no',
        UserKnownHostsFile: '/dev/null'
      });
    
    save(config);
    console.log(`generated config for ${name} in ${configPath}`)
}