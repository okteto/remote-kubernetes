import gp from 'get-port';
import * as net from 'net';

export function getPort(): Promise<number> {
    return gp({port: 22100});
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