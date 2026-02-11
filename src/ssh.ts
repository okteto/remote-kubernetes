'use strict';

import gp from 'get-port';
import * as net from 'net';

let nextPort = 22100;

export function getPort(): Promise<number> {
    const port = nextPort;

    // poorman's port collision avoidance
    nextPort++;
    return gp({host:'127.0.0.1', port: port});
}

export function isReady(port: number): Promise<boolean> {
    return new Promise(function(resolve, reject) {
        const timeout = 60000;
        const timer = setTimeout(function() {
            reject(new Error("timeout"));
            socket.end();
        }, timeout);

        const socket = net.createConnection(port, "localhost", function() {
            clearTimeout(timer);
            resolve(true);
            socket.end();
        });

        socket.on('error', function(err) {
            clearTimeout(timer);
            reject(err);
        });
    });
}