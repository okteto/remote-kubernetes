import * as fs from 'fs';

/**
 * Kinds of failure that `MtimeCache` can report back to the caller. `read`
 * covers `fs.statSync` and `fs.readFileSync` errors (other than ENOENT, which
 * is treated as the "file is simply not present" case and is reported silently
 * as `undefined`). `parse` covers errors thrown by the parser function.
 */
export type MtimeCacheErrorKind = 'read' | 'parse';

export interface MtimeCacheOptions {
    /**
     * Called when the cache encounters an unexpected error: a `stat`/`read`
     * failure that isn't ENOENT, or a parse failure. Allows the caller to
     * preserve diagnostic logging while the cache itself stays generic.
     *
     * Not called for missing files — those are an expected steady state.
     */
    onError?: (err: unknown, kind: MtimeCacheErrorKind) => void;
}

function isMissingFileError(err: unknown): boolean {
    return typeof err === 'object'
        && err !== null
        && 'code' in err
        && (err as {code: unknown}).code === 'ENOENT';
}

/**
 * Sync file cache keyed on mtime. Re-reads + re-parses only when the file's
 * mtime changes; returns the cached value otherwise. Suitable for tiny JSON
 * config files that are read in the hot path (e.g. on every command), where
 * the cost of `JSON.parse` matters but a single `statSync` does not.
 *
 * Returns `undefined` when the file is missing, unreadable, or the parser
 * throws — callers translate that into a default value. Pass `onError` in
 * the options to receive unexpected failures (read/parse) for logging.
 */
export class MtimeCache<T> {
    private cached?: T;
    private cachedMtimeMs?: number;

    constructor(
        private readonly filepath: string,
        private readonly parse: (raw: string) => T,
        private readonly options: MtimeCacheOptions = {},
    ) {}

    read(): T | undefined {
        let stats: fs.Stats;
        try {
            stats = fs.statSync(this.filepath);
        } catch (err: unknown) {
            // ENOENT is an expected steady state (no config file yet);
            // anything else is worth reporting.
            if (!isMissingFileError(err)) {
                this.options.onError?.(err, 'read');
            }
            this.cached = undefined;
            this.cachedMtimeMs = undefined;
            return undefined;
        }

        if (this.cached !== undefined && this.cachedMtimeMs === stats.mtimeMs) {
            return this.cached;
        }

        let raw: string;
        try {
            raw = fs.readFileSync(this.filepath, {encoding: 'utf8'});
        } catch (err: unknown) {
            this.options.onError?.(err, 'read');
            this.cached = undefined;
            this.cachedMtimeMs = undefined;
            return undefined;
        }

        try {
            const parsed = this.parse(raw);
            this.cached = parsed;
            this.cachedMtimeMs = stats.mtimeMs;
            return parsed;
        } catch (err: unknown) {
            this.options.onError?.(err, 'parse');
            this.cached = undefined;
            this.cachedMtimeMs = undefined;
            return undefined;
        }
    }

    /**
     * Drops the cache so the next `read()` does a fresh disk read regardless
     * of mtime. Call after explicit mutations that may not bump the file's
     * mtime (e.g. atomic rename onto a filesystem with low-resolution mtimes).
     */
    invalidate(): void {
        this.cached = undefined;
        this.cachedMtimeMs = undefined;
    }
}
