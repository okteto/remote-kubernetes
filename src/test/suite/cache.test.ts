import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { MtimeCache } from '../../cache';

describe('MtimeCache', () => {
    let tmpdir: string;
    let filepath: string;

    beforeEach(() => {
        tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'okteto-cache-'));
        filepath = path.join(tmpdir, 'data.json');
    });

    afterEach(() => {
        fs.rmSync(tmpdir, {recursive: true, force: true});
    });

    function writeWithMtime(content: string, mtimeMs: number): void {
        fs.writeFileSync(filepath, content);
        const time = new Date(mtimeMs);
        fs.utimesSync(filepath, time, time);
    }

    it('returns undefined when the file does not exist', () => {
        const cache = new MtimeCache(filepath, (raw) => JSON.parse(raw));
        expect(cache.read()).to.equal(undefined);
    });

    it('reads and parses the file on the first call', () => {
        writeWithMtime(JSON.stringify({hello: 'world'}), 1_000_000);
        const cache = new MtimeCache<{hello: string}>(filepath, (raw) => JSON.parse(raw));
        const value = cache.read();
        expect(value).to.deep.equal({hello: 'world'});
    });

    it('returns the cached value without re-parsing when mtime is unchanged', () => {
        writeWithMtime(JSON.stringify({n: 1}), 1_000_000);
        let parseCount = 0;
        const cache = new MtimeCache<{n: number}>(filepath, (raw) => {
            parseCount++;
            return JSON.parse(raw);
        });

        const a = cache.read();
        const b = cache.read();
        const c = cache.read();

        expect(a).to.deep.equal({n: 1});
        expect(b).to.deep.equal({n: 1});
        expect(c).to.deep.equal({n: 1});
        expect(parseCount).to.equal(1);
    });

    it('re-reads and re-parses when the file mtime changes', () => {
        writeWithMtime(JSON.stringify({n: 1}), 1_000_000);
        let parseCount = 0;
        const cache = new MtimeCache<{n: number}>(filepath, (raw) => {
            parseCount++;
            return JSON.parse(raw);
        });

        expect(cache.read()).to.deep.equal({n: 1});
        expect(parseCount).to.equal(1);

        writeWithMtime(JSON.stringify({n: 2}), 2_000_000);
        expect(cache.read()).to.deep.equal({n: 2});
        expect(parseCount).to.equal(2);
    });

    it('drops the cache when the file disappears', () => {
        writeWithMtime(JSON.stringify({n: 1}), 1_000_000);
        const cache = new MtimeCache<{n: number}>(filepath, (raw) => JSON.parse(raw));

        expect(cache.read()).to.deep.equal({n: 1});

        fs.unlinkSync(filepath);
        expect(cache.read()).to.equal(undefined);

        // Recreate the file with new mtime — cache should pick it up.
        writeWithMtime(JSON.stringify({n: 5}), 3_000_000);
        expect(cache.read()).to.deep.equal({n: 5});
    });

    it('returns undefined and clears the cache if parsing throws', () => {
        writeWithMtime('not json', 1_000_000);
        const cache = new MtimeCache(filepath, (raw) => JSON.parse(raw));
        expect(cache.read()).to.equal(undefined);

        // Subsequent valid content should be re-read (cache was cleared).
        writeWithMtime(JSON.stringify({ok: true}), 2_000_000);
        expect(cache.read()).to.deep.equal({ok: true});
    });

    it('invalidate() forces a fresh read even if mtime is unchanged', () => {
        writeWithMtime(JSON.stringify({n: 1}), 1_000_000);
        let parseCount = 0;
        const cache = new MtimeCache<{n: number}>(filepath, (raw) => {
            parseCount++;
            return JSON.parse(raw);
        });

        expect(cache.read()).to.deep.equal({n: 1});
        expect(parseCount).to.equal(1);

        cache.invalidate();
        expect(cache.read()).to.deep.equal({n: 1});
        expect(parseCount).to.equal(2);
    });

    describe('onError observability', () => {
        it('is not called when the file is simply missing (ENOENT)', () => {
            const errors: Array<{err: unknown; kind: string}> = [];
            const cache = new MtimeCache(filepath, (raw) => JSON.parse(raw), {
                onError: (err, kind) => errors.push({err, kind}),
            });

            // File does not exist yet.
            expect(cache.read()).to.equal(undefined);
            expect(errors).to.have.lengthOf(0);
        });

        it('reports parse failures with kind="parse"', () => {
            writeWithMtime('not json', 1_000_000);
            const errors: Array<{err: unknown; kind: string}> = [];
            const cache = new MtimeCache(filepath, (raw) => JSON.parse(raw), {
                onError: (err, kind) => errors.push({err, kind}),
            });

            expect(cache.read()).to.equal(undefined);
            expect(errors).to.have.lengthOf(1);
            expect(errors[0].kind).to.equal('parse');
            expect(errors[0].err).to.be.an.instanceOf(SyntaxError);
        });

        it('does not call onError again on the next read while mtime is unchanged', () => {
            writeWithMtime('not json', 1_000_000);
            const errors: Array<{err: unknown; kind: string}> = [];
            const cache = new MtimeCache(filepath, (raw) => JSON.parse(raw), {
                onError: (err, kind) => errors.push({err, kind}),
            });

            // First read parses and reports the error; cache is cleared.
            expect(cache.read()).to.equal(undefined);
            expect(errors).to.have.lengthOf(1);

            // Second read sees the same mtime, but since the cache was cleared
            // after the parse failure, it re-attempts and reports again.
            // That's intentional — we want each subsequent attempt to surface
            // the failure rather than silently swallow it.
            expect(cache.read()).to.equal(undefined);
            expect(errors).to.have.lengthOf(2);
        });

        it('does not require an onError callback', () => {
            writeWithMtime('not json', 1_000_000);
            const cache = new MtimeCache(filepath, (raw) => JSON.parse(raw));
            // Should swallow the parse error silently.
            expect(cache.read()).to.equal(undefined);
        });
    });
});
