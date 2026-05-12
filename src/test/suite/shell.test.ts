'use strict';

import { expect } from 'chai';
import { posixQuote } from '../../shell';

describe('posixQuote', () => {
    it('wraps a simple value in single quotes', () => {
        expect(posixQuote('hello')).to.equal(`'hello'`);
    });

    it('quotes values with spaces', () => {
        expect(posixQuote('/Program Files/okteto')).to.equal(`'/Program Files/okteto'`);
    });

    it('escapes embedded single quotes', () => {
        expect(posixQuote(`it's`)).to.equal(`'it'\\''s'`);
    });

    it('handles multiple embedded single quotes', () => {
        expect(posixQuote(`a'b'c`)).to.equal(`'a'\\''b'\\''c'`);
    });

    it('quotes an empty string', () => {
        expect(posixQuote('')).to.equal(`''`);
    });

    it('quotes shell metacharacters as literal text', () => {
        expect(posixQuote('$(rm -rf /)')).to.equal(`'$(rm -rf /)'`);
        expect(posixQuote('a;b|c&d')).to.equal(`'a;b|c&d'`);
        expect(posixQuote('foo`bar`')).to.equal(`'foo\`bar\`'`);
    });
});
