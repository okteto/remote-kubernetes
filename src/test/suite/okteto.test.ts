import { expect } from 'chai';
import sinon from 'sinon';
import * as okteto from '../../okteto';

describe('Context', () => {
  it('should create a context with all fields', () => {
    const ctx = new okteto.Context('id1', 'name1', 'ns1', true);
    expect(ctx.id).to.equal('id1');
    expect(ctx.name).to.equal('name1');
    expect(ctx.namespace).to.equal('ns1');
    expect(ctx.isOkteto).to.equal(true);
  });

  it('should create a context with empty fields', () => {
    const ctx = new okteto.Context('', '', '', false);
    expect(ctx.id).to.equal('');
    expect(ctx.name).to.equal('');
    expect(ctx.namespace).to.equal('');
    expect(ctx.isOkteto).to.equal(false);
  });
});

describe('state', () => {
  it('should have all expected states', () => {
    expect(okteto.state.starting).to.equal('starting');
    expect(okteto.state.activating).to.equal('activating');
    expect(okteto.state.attaching).to.equal('attaching');
    expect(okteto.state.pulling).to.equal('pulling');
    expect(okteto.state.startingSync).to.equal('startingSync');
    expect(okteto.state.synchronizing).to.equal('synchronizing');
    expect(okteto.state.ready).to.equal('ready');
    expect(okteto.state.unknown).to.equal('unknown');
    expect(okteto.state.failed).to.equal('failed');
  });
});

describe('getStateMessages', () => {
  it('should return messages for all known states', () => {
    const messages = okteto.getStateMessages();
    expect(messages.get(okteto.state.starting)).to.be.a('string');
    expect(messages.get(okteto.state.activating)).to.be.a('string');
    expect(messages.get(okteto.state.attaching)).to.be.a('string');
    expect(messages.get(okteto.state.pulling)).to.be.a('string');
    expect(messages.get(okteto.state.startingSync)).to.be.a('string');
    expect(messages.get(okteto.state.synchronizing)).to.be.a('string');
    expect(messages.get(okteto.state.ready)).to.be.a('string');
  });

  it('should not have a message for unknown state', () => {
    const messages = okteto.getStateMessages();
    expect(messages.has(okteto.state.unknown)).to.equal(false);
    expect(messages.has(okteto.state.failed)).to.equal(false);
  });
});

describe('splitStateError', () => {
  it('should parse state without error', () => {
    const result = okteto.splitStateError('ready');
    expect(result.state).to.equal('ready');
    expect(result.message).to.equal('');
  });

  it('should parse state with error message', () => {
    const result = okteto.splitStateError('failed:something went wrong');
    expect(result.state).to.equal('failed');
    expect(result.message).to.equal('something went wrong');
  });

  it('should preserve colons in error message', () => {
    const result = okteto.splitStateError('failed:error: connection refused: timeout');
    expect(result.state).to.equal('failed');
    expect(result.message).to.equal('error: connection refused: timeout');
  });

  it('should handle empty string', () => {
    const result = okteto.splitStateError('');
    expect(result.state).to.equal('');
    expect(result.message).to.equal('');
  });

  it('should handle state with empty error message', () => {
    const result = okteto.splitStateError('failed:');
    expect(result.state).to.equal('failed');
    expect(result.message).to.equal('');
  });

  it('should handle multiple colons in state name', () => {
    const result = okteto.splitStateError('custom:state:name:error message here');
    expect(result.state).to.equal('custom');
    expect(result.message).to.equal('state:name:error message here');
  });

  it('should handle whitespace in error message', () => {
    const result = okteto.splitStateError('failed:  spaces  everywhere  ');
    expect(result.state).to.equal('failed');
    expect(result.message).to.equal('  spaces  everywhere  ');
  });
});

describe('computeInstallState', () => {
  const minimum = '3.19.0';

  it('requires install when the binary is not present', () => {
    expect(okteto.computeInstallState(false, undefined, minimum)).to.deep.equal({
      install: true,
      upgrade: false,
    });
  });

  it('does nothing when installed and the version cannot be parsed', () => {
    expect(okteto.computeInstallState(true, undefined, minimum)).to.deep.equal({
      install: false,
      upgrade: false,
    });
  });

  it('does nothing when the installed version meets the minimum', () => {
    expect(okteto.computeInstallState(true, '3.19.0', minimum)).to.deep.equal({
      install: false,
      upgrade: false,
    });
  });

  it('does nothing when the installed version exceeds the minimum', () => {
    expect(okteto.computeInstallState(true, '3.20.1', minimum)).to.deep.equal({
      install: false,
      upgrade: false,
    });
  });

  it('reports both install and upgrade when the installed version is outdated', () => {
    expect(okteto.computeInstallState(true, '3.18.0', minimum)).to.deep.equal({
      install: true,
      upgrade: true,
    });
  });

  it('does not return upgrade=true alongside install=false', () => {
    // Regression: needsInstall used to always return upgrade=true regardless
    // of whether the installed version was outdated.
    const result = okteto.computeInstallState(true, '3.20.0', minimum);
    expect(result.install).to.equal(false);
    expect(result.upgrade).to.equal(false);
  });
});

describe('notifyIfFailed', () => {
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
    sinon.restore();
  });

  it('passes (message, suffix) — not (suffix, message) — to the callback', async () => {
    const getStateFn = sinon.stub().resolves({ state: okteto.state.failed, message: 'kaboom' });
    const callback = sinon.spy();

    const handle = okteto.notifyIfFailed('my-ns', 'my-svc', callback, {
      pollIntervalMs: 10,
      shouldContinue: () => true,
      getStateFn,
    });

    await clock.tickAsync(10);
    await clock.tickAsync(0);

    expect(callback.calledOnce).to.equal(true);
    const [first, second] = callback.firstCall.args;
    expect(first).to.equal('Okteto: Up command failed: kaboom');
    expect(second).to.equal('my-ns-my-svc');

    handle.dispose();
  });

  it('uses a fallback message when failure has no detail', async () => {
    const getStateFn = sinon.stub().resolves({ state: okteto.state.failed, message: '' });
    const callback = sinon.spy();

    const handle = okteto.notifyIfFailed('ns', 'svc', callback, {
      pollIntervalMs: 5,
      shouldContinue: () => true,
      getStateFn,
    });

    await clock.tickAsync(5);
    await clock.tickAsync(0);

    expect(callback.calledOnce).to.equal(true);
    expect(callback.firstCall.args[0]).to.equal('Okteto: Up command failed');
    expect(callback.firstCall.args[1]).to.equal('ns-svc');

    handle.dispose();
  });

  it('stops polling after dispose() is called', async () => {
    const getStateFn = sinon.stub().resolves({ state: okteto.state.starting, message: '' });
    const callback = sinon.spy();

    const handle = okteto.notifyIfFailed('ns', 'svc', callback, {
      pollIntervalMs: 5,
      shouldContinue: () => true,
      getStateFn,
    });

    await clock.tickAsync(5);
    await clock.tickAsync(0);
    const callsBefore = getStateFn.callCount;
    expect(callsBefore).to.be.greaterThan(0);

    handle.dispose();

    await clock.tickAsync(100);
    await clock.tickAsync(0);

    expect(getStateFn.callCount).to.equal(callsBefore);
    expect(callback.called).to.equal(false);
  });

  it('stops polling when shouldContinue returns false', async () => {
    const getStateFn = sinon.stub().resolves({ state: okteto.state.starting, message: '' });
    let active = true;
    const callback = sinon.spy();

    okteto.notifyIfFailed('ns', 'svc', callback, {
      pollIntervalMs: 5,
      shouldContinue: () => active,
      getStateFn,
    });

    await clock.tickAsync(5);
    await clock.tickAsync(0);
    expect(getStateFn.callCount).to.be.greaterThan(0);

    active = false;
    const callsAtStop = getStateFn.callCount;

    await clock.tickAsync(50);
    await clock.tickAsync(0);

    // The next tick observes shouldContinue=false and stops without calling getStateFn.
    expect(getStateFn.callCount).to.equal(callsAtStop);
    expect(callback.called).to.equal(false);
  });
});
