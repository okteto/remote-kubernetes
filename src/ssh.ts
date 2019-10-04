'use strict';

import * as ssh from 'ssh-config';
import * as fs from 'fs';
import * as home from 'user-home';
import * as path from 'path';
import * as gp from 'get-port';
import * as net from 'net';

export function removeConfig(name: string) :Promise<string> {
    return new Promise<string>((resolve, reject) =>{
        let config = getConfig();
        config.remove({ Host: name });
        save(config).then(()=>{
            console.log(`removed config for ${name}`);
            resolve();
        }, (reason) => {
            reject(reason.message);
        });
    });
}

export function updateConfig(name: string, port: number): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const configPath = path.join(home, ".ssh", "config");
        fs.exists(configPath, (exists) => {
            if (exists) {
                addToExisting(configPath, name, port).then(
                    () => resolve(),
                    (reason) => reject(reason)
                );
            } else {
                addToNew(configPath, name, port).then(
                    () => resolve(),
                    (reason) => reject(reason)
                );
                
            }
        });
    });
}

export function getPort(): Promise<number> {
    return gp({port: 22000});
}

function getEntry(name: string, port: number): any {
    return {
        Host: name,
        HostName: 'localhost',
        User: 'root',
        Port: port,
        ForwardAgent: 'yes',
        StrictHostKeyChecking: 'no',
        UserKnownHostsFile: '/dev/null'
    };
}

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

    return config;
}

function addToExisting(configPath: string, name:string, port: number): Promise<string> {
    return new Promise<string>((resolve, reject) =>{
        fs.readFile(configPath, {encoding: 'utf8'}, (err, data) => {
            if (err) {
                reject(err.message);
                return;
            }

            const config = ssh.parse(data);
            config.remove({ Host: name });
            config.append(getEntry(name, port));
            save(config).then(
                () => resolve(),
                (reason) => reject(reason)
            );
        });
    });
}

function addToNew(configPath: string, name:string, port: number): Promise<string> {
    return new Promise<string>((resolve, reject) => {
    const config = new ssh();
    config.append(getEntry(name, port));
    save(config).then(
        () => {resolve();}, 
        (reason) =>{reject(reason);});
    });
}

function save(config: any): Promise<string> {
    return new Promise<string>((resolve, reject) =>{
        const content = ssh.stringify(config);
        const configPath = getPath();
        fs.writeFile(configPath, content, { flag: 'w' }, (err)=> {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });      
}

export function isReady(port: number): Promise<Boolean> {
    return new Promise(function(resolve, reject) {
        const timeout = 60000;
        var timer = setTimeout(function() {
            reject("timeout");
            socket.end();
        }, timeout);

        var socket = net.createConnection(port, "localhost", function() {
            clearTimeout(timer);
            resolve();
            socket.end();
        });

        socket.on('error', function(err) {
            clearTimeout(timer);
            reject(err);
        });
    });
}