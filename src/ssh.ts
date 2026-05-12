import gp from 'get-port';
import * as net from 'net';

const STARTING_PORT = 22100;

/**
 * Sequential port allocator with collision avoidance. Hands out a starting
 * candidate to `get-port`, which probes upward from that candidate until it
 * finds a free port on 127.0.0.1. Encapsulated so the cursor state is not a
 * floating module global — and so tests can construct a fresh allocator.
 */
export class PortAllocator {
    private cursor: number;

    constructor(private readonly start: number = STARTING_PORT) {
        this.cursor = start;
    }

    /**
     * Returns the next available port on 127.0.0.1, biased toward the cursor.
     * The cursor advances on every call regardless of whether `get-port` had
     * to skip occupied ports, so two back-to-back calls don't probe from the
     * same starting point.
     */
    async next(): Promise<number> {
        const candidate = this.cursor;
        this.cursor++;
        return gp({host: '127.0.0.1', port: candidate});
    }
}

const defaultAllocator = new PortAllocator();

/**
 * Gets an available port for SSH forwarding.
 * Uses a sequential port allocation starting from 22100 with collision avoidance.
 * @returns Promise that resolves to an available port number
 */
export function getPort(): Promise<number> {
    return defaultAllocator.next();
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
