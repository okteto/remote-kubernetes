'use strict';

import gp from 'get-port';
import * as net from 'net';

let nextPort = 22100;

/**
 * Gets an available port for SSH forwarding.
 * Uses a sequential port allocation starting from 22100 with collision avoidance.
 * @returns Promise that resolves to an available port number
 */
export function getPort(): Promise<number> {
    const port = nextPort;

    // poorman's port collision avoidance
    nextPort++;
    return gp({host:'127.0.0.1', port: port});
}

/**
 * Checks if SSH server is ready on the specified port.
 * Attempts to connect to localhost on the given port with a 60 second timeout.
 * @param port - The port to check
 * @returns Promise that resolves to true if SSH is ready, rejects if connection fails or times out
 */
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