'use strict';

import { expect } from 'chai';
import sinon from 'sinon';
import * as vscode from 'vscode';
import * as telemetry from '../../telemetry';
import * as okteto from '../../okteto';

type MockVSCode = typeof vscode & {
  __mock: {
    reset: () => void;
  };
};

interface ReporterCtor {
  new (...args: unknown[]): {
    track: (event: string) => Promise<void>;
    captureError: (message: string, err: unknown) => void;
    dispose: () => void;
  };
}

interface MutableTelemetryModule {
  Reporter: ReporterCtor;
}

function activateExtension() {
  delete require.cache[require.resolve('../../extension')];
  const extension = require('../../extension') as { activate: (ctx: { subscriptions: Array<{ dispose: () => void }> }) => void };
  const context = { subscriptions: [] as Array<{ dispose: () => void }> };
  extension.activate(context);
}

describe('extension reporter lifecycle', () => {
  const mockVSCode = vscode as unknown as MockVSCode;

  beforeEach(() => {
    mockVSCode.__mock.reset();
    sinon.restore();
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should dispose previous reporter when replacing it after context change', async () => {
    const reporterInstances: Array<{ disposed: boolean }> = [];

    const telemetryModule = telemetry as unknown as MutableTelemetryModule;
    const originalReporter = telemetryModule.Reporter;
    function FakeReporter(this: { disposed: boolean }) {
      this.disposed = false;
      reporterInstances.push(this);
    }
    (FakeReporter as unknown as ReporterCtor).prototype.track = async function () {};
    (FakeReporter as unknown as ReporterCtor).prototype.captureError = function () {};
    (FakeReporter as unknown as ReporterCtor).prototype.dispose = function () {
      this.disposed = true;
    };
    telemetryModule.Reporter = FakeReporter as unknown as ReporterCtor;
    try {
      sinon.stub(okteto, 'needsInstall').resolves({ install: false, upgrade: false });
      sinon.stub(okteto, 'getContext').returns({ id: 'ctx-id', name: 'ctx-name', namespace: 'ns', isOkteto: true });
      sinon.stub(okteto, 'getMachineId').returns('machine-id');
      sinon.stub(okteto, 'getContextList').resolves([] as unknown as Awaited<ReturnType<typeof okteto.getContextList>>);
      sinon.stub(okteto, 'setContext').resolves(true);

      sinon.stub(vscode.window, 'showQuickPick').resolves(
        { value: 'ctx-name' } as vscode.QuickPickItem & { value: string },
      );
      sinon.stub(vscode.window, 'showInformationMessage').resolves(undefined);

      activateExtension();

      await vscode.commands.executeCommand('okteto.context');

      expect(reporterInstances.length).to.equal(2);
      expect(reporterInstances[0].disposed).to.equal(true);
      expect(reporterInstances[1].disposed).to.equal(false);
    } finally {
      telemetryModule.Reporter = originalReporter;
    }
  });
});

describe('namespace command', () => {
  const mockVSCode = vscode as unknown as MockVSCode;

  beforeEach(() => {
    mockVSCode.__mock.reset();
    sinon.restore();
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should set namespace from quick pick selection', async () => {
    sinon.stub(okteto, 'needsInstall').resolves({ install: false, upgrade: false });
    sinon.stub(okteto, 'getContext').returns({ id: 'ctx-id', name: 'ctx-name', namespace: 'ns', isOkteto: true });
    sinon.stub(okteto, 'getMachineId').returns('machine-id');
    sinon.stub(okteto, 'getNamespaceList').resolves([
      { label: 'dev', description: 'Current namespace', value: 'dev' } as vscode.QuickPickItem & { value: string },
      { label: 'staging', description: '', value: 'staging' } as vscode.QuickPickItem & { value: string },
    ] as unknown as Awaited<ReturnType<typeof okteto.getNamespaceList>>);
    const setNamespace = sinon.stub(okteto, 'setNamespace').resolves(true);

    sinon.stub(vscode.window, 'showQuickPick').resolves(
      { label: 'staging', description: '', value: 'staging' } as vscode.QuickPickItem & { value: string },
    );
    const showInputBox = sinon.stub(vscode.window, 'showInputBox').resolves('ignored');

    activateExtension();
    await vscode.commands.executeCommand('okteto.namespace');

    expect(setNamespace.calledOnceWithExactly('staging')).to.equal(true);
    expect(showInputBox.called).to.equal(false);
  });

  it('should allow entering namespace manually', async () => {
    sinon.stub(okteto, 'needsInstall').resolves({ install: false, upgrade: false });
    sinon.stub(okteto, 'getContext').returns({ id: 'ctx-id', name: 'ctx-name', namespace: 'ns', isOkteto: true });
    sinon.stub(okteto, 'getMachineId').returns('machine-id');
    sinon.stub(okteto, 'getNamespaceList').resolves([] as unknown as Awaited<ReturnType<typeof okteto.getNamespaceList>>);
    const setNamespace = sinon.stub(okteto, 'setNamespace').resolves(true);

    sinon.stub(vscode.window, 'showQuickPick').resolves(
      { label: 'Enter namespace manually', description: 'Type a namespace name', value: 'manual' } as vscode.QuickPickItem & { value: string },
    );
    sinon.stub(vscode.window, 'showInputBox').resolves('my-custom-namespace');

    activateExtension();
    await vscode.commands.executeCommand('okteto.namespace');

    expect(setNamespace.calledOnceWithExactly('my-custom-namespace')).to.equal(true);
  });

  it('should not set namespace when picker is dismissed', async () => {
    sinon.stub(okteto, 'needsInstall').resolves({ install: false, upgrade: false });
    sinon.stub(okteto, 'getContext').returns({ id: 'ctx-id', name: 'ctx-name', namespace: 'ns', isOkteto: true });
    sinon.stub(okteto, 'getMachineId').returns('machine-id');
    sinon.stub(okteto, 'getNamespaceList').resolves([] as unknown as Awaited<ReturnType<typeof okteto.getNamespaceList>>);
    const setNamespace = sinon.stub(okteto, 'setNamespace').resolves(true);

    sinon.stub(vscode.window, 'showQuickPick').resolves(undefined);
    const showInputBox = sinon.stub(vscode.window, 'showInputBox').resolves('ignored');

    activateExtension();
    await vscode.commands.executeCommand('okteto.namespace');

    expect(setNamespace.called).to.equal(false);
    expect(showInputBox.called).to.equal(false);
  });
});
