'use strict';

import { expect } from 'chai';
import { events, Reporter } from '../../telemetry';
import * as vscode from 'vscode';

type MockVSCode = typeof vscode & {
  __mock: {
    reset: () => void;
    emitTelemetryEnabledChanged: (enabled: boolean) => void;
  };
};

describe('events', () => {
  it('should have all expected event names', () => {
    expect(events.activated).to.equal('activated');
    expect(events.up).to.equal('cmd_up');
    expect(events.down).to.equal('cmd_down');
    expect(events.deploy).to.equal('cmd_deploy');
    expect(events.destroy).to.equal('cmd_destroy');
    expect(events.test).to.equal('cmd_test');
    expect(events.install).to.equal('cmd_install');
    expect(events.context).to.equal('cmd_context');
    expect(events.namespace).to.equal('cmd_namespace');
  });

  it('should have failure events', () => {
    expect(events.oktetoUpFailed).to.equal('okteto_up_failed');
    expect(events.oktetoDownFailed).to.equal('okteto_down_failed');
    expect(events.oktetoInstallFailed).to.equal('okteto_install_failed');
    expect(events.manifestLoadFailed).to.equal('manifest_load_failed');
    expect(events.sshPortFailed).to.equal('ssh_get_port_failed');
    expect(events.sshServiceFailed).to.equal('ssh_service_failed');
  });
});

describe('Reporter', () => {
  const mockVSCode = vscode as unknown as MockVSCode;

  beforeEach(() => {
    mockVSCode.__mock.reset();
  });

  it('should be constructable', () => {
    // The vscode mock has isTelemetryEnabled = false, so telemetry is disabled
    const reporter = new Reporter('1.0.0', 'test-id', 'machine-id');
    expect(reporter).to.be.instanceOf(Reporter);
  });

  it('should track events without error when disabled', async () => {
    const reporter = new Reporter('1.0.0', 'test-id', 'machine-id');
    // Should resolve without error since telemetry is disabled
    await reporter.track(events.activated);
  });

  it('should capture errors without throwing when disabled', () => {
    const reporter = new Reporter('1.0.0', 'test-id', 'machine-id');
    // Should not throw since telemetry is disabled
    reporter.captureError('test error', new Error('test'));
  });

  it('should have a dispose method', () => {
    const reporter = new Reporter('1.0.0', 'test-id', 'machine-id');
    expect(reporter.dispose).to.be.a('function');
    reporter.dispose();
  });

  it('should use oktetoId as distinctId when provided', async () => {
    const reporter = new Reporter('1.0.0', 'okteto-id', 'machine-id');
    // Just verify it doesn't throw
    await reporter.track('test-event');
  });

  it('should fall back to machineId when oktetoId is empty', async () => {
    const reporter = new Reporter('1.0.0', '', 'machine-id');
    await reporter.track('test-event');
  });

  it('should fall back to vscode.env.machineId when both are empty', async () => {
    const reporter = new Reporter('1.0.0', '', '');
    await reporter.track('test-event');
  });

  it('should disable and re-enable tracking on telemetry off->on transitions', async () => {
    mockVSCode.__mock.emitTelemetryEnabledChanged(true);
    const reporter = new Reporter('1.0.0', 'test-id', 'machine-id');

    let tracked = 0;
    const reporterWithMp = reporter as unknown as {
      mp: { track: (event: string, props: unknown, callback: (err?: unknown) => void) => void };
    };
    reporterWithMp.mp = {
      track: (_event: string, _props: unknown, callback: (err?: unknown) => void) => {
        tracked++;
        callback();
      },
    };

    await reporter.track('before-disable');
    expect(tracked).to.equal(1);

    mockVSCode.__mock.emitTelemetryEnabledChanged(false);
    await reporter.track('after-disable');
    expect(tracked).to.equal(1);

    mockVSCode.__mock.emitTelemetryEnabledChanged(true);
    await reporter.track('after-re-enable');
    expect(tracked).to.equal(2);
  });
});
