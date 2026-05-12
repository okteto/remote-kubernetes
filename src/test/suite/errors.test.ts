import { expect } from 'chai';
import { getErrorMessage } from '../../errors';

describe('getErrorMessage', () => {
    it('returns the message of an Error instance', () => {
        expect(getErrorMessage(new Error('boom'))).to.equal('boom');
    });

    it('preserves subclass error messages', () => {
        class CustomError extends Error {}
        expect(getErrorMessage(new CustomError('custom-boom'))).to.equal('custom-boom');
    });

    it('returns strings as-is', () => {
        expect(getErrorMessage('something failed')).to.equal('something failed');
    });

    it('stringifies plain objects', () => {
        expect(getErrorMessage({ code: 'ENOENT', path: '/tmp/x' })).to.equal(
            '{"code":"ENOENT","path":"/tmp/x"}',
        );
    });

    it('handles undefined', () => {
        expect(getErrorMessage(undefined)).to.equal('undefined');
    });

    it('handles null', () => {
        expect(getErrorMessage(null)).to.equal('null');
    });

    it('handles numbers', () => {
        expect(getErrorMessage(42)).to.equal('42');
    });

    it('falls back to String() for values JSON.stringify cannot serialize', () => {
        const circular: Record<string, unknown> = {};
        circular.self = circular;
        // Should not throw, and should return some non-empty string.
        const result = getErrorMessage(circular);
        expect(result).to.be.a('string');
        expect(result.length).to.be.greaterThan(0);
    });
});
