import { expect } from 'chai';
import * as vscode from 'vscode';

type MockChannel = { name: string; disposed: boolean };
type MockVSCode = typeof vscode & {
    __mock: {
        reset: () => void;
        getOutputChannels: () => MockChannel[];
    };
};

interface LoggerModule {
    initializeLogger: () => vscode.LogOutputChannel;
    getLogger: () => vscode.LogOutputChannel;
    disposeLogger: () => void;
}

function loadLogger(): LoggerModule {
    delete require.cache[require.resolve('../../logger')];
    return require('../../logger') as LoggerModule;
}

describe('logger', () => {
    const mockVSCode = vscode as unknown as MockVSCode;

    beforeEach(() => {
        mockVSCode.__mock.reset();
    });

    it('initializeLogger creates a single LogOutputChannel', () => {
        const logger = loadLogger();
        const first = logger.initializeLogger();
        const second = logger.initializeLogger();

        expect(first).to.equal(second);
        expect(mockVSCode.__mock.getOutputChannels().length).to.equal(1);
    });

    it('getLogger returns the same instance after initializeLogger', () => {
        const logger = loadLogger();
        const initialized = logger.initializeLogger();
        expect(logger.getLogger()).to.equal(initialized);
        expect(mockVSCode.__mock.getOutputChannels().length).to.equal(1);
    });

    it('getLogger auto-initializes when called without an explicit init', () => {
        const logger = loadLogger();
        const channel = logger.getLogger();
        expect(channel).to.not.equal(undefined);
        expect(mockVSCode.__mock.getOutputChannels().length).to.equal(1);
    });

    describe('disposeLogger', () => {
        it('disposes the active channel and clears the cached reference', () => {
            const logger = loadLogger();
            const first = logger.getLogger();
            expect((first as unknown as MockChannel).disposed).to.equal(false);

            logger.disposeLogger();
            expect((first as unknown as MockChannel).disposed).to.equal(true);
        });

        it('does not throw when called with no active channel', () => {
            const logger = loadLogger();
            expect(() => logger.disposeLogger()).to.not.throw();
        });

        it('is idempotent — calling twice does not throw and does not re-create the channel', () => {
            const logger = loadLogger();
            logger.getLogger();
            logger.disposeLogger();
            expect(() => logger.disposeLogger()).to.not.throw();
            // No new channel created after disposal until a getLogger call.
            expect(mockVSCode.__mock.getOutputChannels().length).to.equal(1);
        });

        it('after dispose, the next getLogger creates a fresh channel', () => {
            const logger = loadLogger();
            const first = logger.getLogger();
            logger.disposeLogger();

            const second = logger.getLogger();
            expect(second).to.not.equal(first);
            expect(mockVSCode.__mock.getOutputChannels().length).to.equal(2);
            expect((first as unknown as MockChannel).disposed).to.equal(true);
            expect((second as unknown as MockChannel).disposed).to.equal(false);
        });
    });
});
