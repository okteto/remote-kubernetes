'use strict';

import { expect } from 'chai';
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
