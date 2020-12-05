'use strict';

import * as gp from 'get-port';
import * as net from 'net';

export function getPort(): Promise<number> {
    return gp({host:'127.0.0.1', port: 22100});
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