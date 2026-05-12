'use strict';

/**
 * Extracts a human-readable message from an unknown thrown value.
 * Returns the Error's message for Error instances; otherwise stringifies.
 *
 * @param err - The value that was thrown (typically caught from try/catch)
 * @returns A human-readable error message
 */
export function getErrorMessage(err: unknown): string {
    if (err instanceof Error) {
        return err.message;
    }

    if (typeof err === 'string') {
        return err;
    }

    if (err === undefined) {
        return 'undefined';
    }

    if (err === null) {
        return 'null';
    }

    try {
        return JSON.stringify(err);
    } catch {
        return String(err);
    }
}
