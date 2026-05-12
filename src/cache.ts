import * as fs from 'fs';

/**
 * Sync file cache keyed on mtime. Re-reads + re-parses only when the file's
 * mtime changes; returns the cached value otherwise. Suitable for tiny JSON
 * config files that are read in the hot path (e.g. on every command), where
 * the cost of `JSON.parse` matters but a single `statSync` does not.
 *
 * Returns `undefined` when the file is missing, unreadable, or the parser
 * throws — callers translate that into a default value.
 */
export class MtimeCache<T> {
    private cached?: T;
    private cachedMtimeMs?: number;

    constructor(
        private readonly filepath: string,
        private readonly parse: (raw: string) => T,
    ) {}

    read(): T | undefined {
        let stats: fs.Stats;
        try {
            stats = fs.statSync(this.filepath);
        } catch {
            // File missing or unreadable: drop any prior cache so a later
            // appearance triggers a fresh read.
            this.cached = undefined;
            this.cachedMtimeMs = undefined;
            return undefined;
        }

        if (this.cached !== undefined && this.cachedMtimeMs === stats.mtimeMs) {
            return this.cached;
        }

        try {
            const raw = fs.readFileSync(this.filepath, {encoding: 'utf8'});
            const parsed = this.parse(raw);
            this.cached = parsed;
            this.cachedMtimeMs = stats.mtimeMs;
            return parsed;
        } catch {
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
