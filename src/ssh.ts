'use strict';

import gp from 'get-port';
import * as net from 'net';

var nextPort = 22100;

export function getPort(): Promise<number> {
    const port = nextPort;
    
    // poorman's port collision avoidance
    nextPort++
    return gp({host:'127.0.0.1', port: port});
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
            resolve(true);
            socket.end();
        });

        socket.on('error', function(err) {
            clearTimeout(timer);
            reject(err);
        });
    });
}