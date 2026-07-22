import { expect } from 'chai';
import sinon from 'sinon';
import * as vscode from 'vscode';
import * as telemetry from '../../telemetry';
import * as okteto from '../../okteto';
import * as manifest from '../../manifest';
import { isManifestSupported, getUpTimeoutSeconds } from '../../extension';

type MockVSCode = typeof vscode & {
  __mock: {
    reset: () => void;
    setConfiguration: (section: string, key: string, value: unknown) => void;
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

interface ExtensionModule {
  activate: (ctx: { subscriptions: Array<{ dispose: () => void }> }) => void;
  deactivate: () => void;
}

function loadExtension(): ExtensionModule {
  delete require.cache[require.resolve('../../extension')];
  return require('../../extension') as ExtensionModule;
}

function activateExtension() {
  const extension = loadExtension();
  const context = { subscriptions: [] as Array<{ dispose: () => void }> };
  extension.activate(context);
}

function installFakeReporter(instances: Array<{ disposed: boolean }>): () => void {
  const telemetryModule = telemetry as unknown as MutableTelemetryModule;
  const originalReporter = telemetryModule.Reporter;

  function FakeReporter(this: { disposed: boolean }) {
    this.disposed = false;
    instances.push(this);
  }
  (FakeReporter as unknown as ReporterCtor).prototype.track = async function () {};
  (FakeReporter as unknown as ReporterCtor).prototype.captureError = function () {};
  (FakeReporter as unknown as ReporterCtor).prototype.dispose = function () {
    this.disposed = true;
  };
  telemetryModule.Reporter = FakeReporter as unknown as ReporterCtor;

  return () => {
    telemetryModule.Reporter = originalReporter;
  };
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
    const restoreReporter = installFakeReporter(reporterInstances);

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
      restoreReporter();
    }
  });
});

describe('extension activate/deactivate lifecycle', () => {
  const mockVSCode = vscode as unknown as MockVSCode;

  beforeEach(() => {
    mockVSCode.__mock.reset();
    sinon.restore();
  });

  afterEach(() => {
    sinon.restore();
  });

  it('activate registers all commands on the supplied context', () => {
    const reporterInstances: Array<{ disposed: boolean }> = [];
    const restoreReporter = installFakeReporter(reporterInstances);

    try {
      sinon.stub(okteto, 'getContext').returns({ id: 'ctx', name: 'ctx', namespace: 'ns', isOkteto: true });
      sinon.stub(okteto, 'getMachineId').returns('machine-id');

      const extension = loadExtension();
      const context = { subscriptions: [] as Array<{ dispose: () => void }> };
      extension.activate(context);

      // 1 LogOutputChannel + 8 command registrations = 9 disposables on the context.
      expect(context.subscriptions.length).to.equal(9);
      expect(reporterInstances.length).to.equal(1);
      expect(reporterInstances[0].disposed).to.equal(false);
    } finally {
      restoreReporter();
    }
  });

  it('deactivate disposes the active reporter', () => {
    const reporterInstances: Array<{ disposed: boolean }> = [];
    const restoreReporter = installFakeReporter(reporterInstances);

    try {
      sinon.stub(okteto, 'getContext').returns({ id: 'ctx', name: 'ctx', namespace: 'ns', isOkteto: true });
      sinon.stub(okteto, 'getMachineId').returns('machine-id');

      const extension = loadExtension();
      extension.activate({ subscriptions: [] as Array<{ dispose: () => void }> });
      expect(reporterInstances[0].disposed).to.equal(false);

      extension.deactivate();
      expect(reporterInstances[0].disposed).to.equal(true);
    } finally {
      restoreReporter();
    }
  });

  it('deactivate is idempotent — calling twice does not throw', () => {
    const reporterInstances: Array<{ disposed: boolean }> = [];
    const restoreReporter = installFakeReporter(reporterInstances);

    try {
      sinon.stub(okteto, 'getContext').returns({ id: 'ctx', name: 'ctx', namespace: 'ns', isOkteto: true });
      sinon.stub(okteto, 'getMachineId').returns('machine-id');

      const extension = loadExtension();
      extension.activate({ subscriptions: [] as Array<{ dispose: () => void }> });

      extension.deactivate();
      expect(() => extension.deactivate()).to.not.throw();
      expect(reporterInstances[0].disposed).to.equal(true);
    } finally {
      restoreReporter();
    }
  });

  it('deactivate without a prior activate does not throw', () => {
    const extension = loadExtension();
    expect(() => extension.deactivate()).to.not.throw();
  });

  it('survives an activate → deactivate → activate round trip with a fresh reporter', () => {
    const reporterInstances: Array<{ disposed: boolean }> = [];
    const restoreReporter = installFakeReporter(reporterInstances);

    try {
      sinon.stub(okteto, 'getContext').returns({ id: 'ctx', name: 'ctx', namespace: 'ns', isOkteto: true });
      sinon.stub(okteto, 'getMachineId').returns('machine-id');

      const extension = loadExtension();

      // First activate cycle.
      const ctx1 = { subscriptions: [] as Array<{ dispose: () => void }> };
      extension.activate(ctx1);
      expect(reporterInstances.length).to.equal(1);
      expect(reporterInstances[0].disposed).to.equal(false);

      // Tear down.
      extension.deactivate();
      expect(reporterInstances[0].disposed).to.equal(true);

      // Re-activate. A fresh Reporter must be constructed; the previous one
      // stays disposed.
      const ctx2 = { subscriptions: [] as Array<{ dispose: () => void }> };
      extension.activate(ctx2);
      expect(reporterInstances.length).to.equal(2);
      expect(reporterInstances[0].disposed).to.equal(true);
      expect(reporterInstances[1].disposed).to.equal(false);
      expect(ctx2.subscriptions.length).to.equal(9);
    } finally {
      restoreReporter();
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
    const createNamespace = sinon.stub(okteto, 'createNamespace').resolves(true);
    const setNamespace = sinon.stub(okteto, 'setNamespace').resolves(true);

    sinon.stub(vscode.window, 'showQuickPick').resolves(
      { label: 'staging', description: '', value: 'staging' } as vscode.QuickPickItem & { value: string },
    );
    const showInputBox = sinon.stub(vscode.window, 'showInputBox').resolves('ignored');

    activateExtension();
    await vscode.commands.executeCommand('okteto.namespace');

    expect(setNamespace.calledOnceWithExactly('staging')).to.equal(true);
    expect(createNamespace.called).to.equal(false);
    expect(showInputBox.called).to.equal(false);
  });

  it('should allow entering namespace manually', async () => {
    sinon.stub(okteto, 'needsInstall').resolves({ install: false, upgrade: false });
    sinon.stub(okteto, 'getContext').returns({ id: 'ctx-id', name: 'ctx-name', namespace: 'ns', isOkteto: true });
    sinon.stub(okteto, 'getMachineId').returns('machine-id');
    sinon.stub(okteto, 'getNamespaceList').resolves([] as unknown as Awaited<ReturnType<typeof okteto.getNamespaceList>>);
    const createNamespace = sinon.stub(okteto, 'createNamespace').resolves(true);
    const setNamespace = sinon.stub(okteto, 'setNamespace').resolves(true);

    sinon.stub(vscode.window, 'showQuickPick').resolves(
      { label: 'Enter namespace manually', description: 'Type a namespace name', value: 'manual' } as vscode.QuickPickItem & { value: string },
    );
    sinon.stub(vscode.window, 'showInputBox').resolves('my-custom-namespace');

    activateExtension();
    await vscode.commands.executeCommand('okteto.namespace');

    expect(createNamespace.calledOnceWithExactly('my-custom-namespace')).to.equal(true);
    expect(setNamespace.calledOnceWithExactly('my-custom-namespace')).to.equal(true);
    sinon.assert.callOrder(createNamespace, setNamespace);
  });

  it('should not set namespace when picker is dismissed', async () => {
    sinon.stub(okteto, 'needsInstall').resolves({ install: false, upgrade: false });
    sinon.stub(okteto, 'getContext').returns({ id: 'ctx-id', name: 'ctx-name', namespace: 'ns', isOkteto: true });
    sinon.stub(okteto, 'getMachineId').returns('machine-id');
    sinon.stub(okteto, 'getNamespaceList').resolves([] as unknown as Awaited<ReturnType<typeof okteto.getNamespaceList>>);
    const createNamespace = sinon.stub(okteto, 'createNamespace').resolves(true);
    const setNamespace = sinon.stub(okteto, 'setNamespace').resolves(true);

    sinon.stub(vscode.window, 'showQuickPick').resolves(undefined);
    const showInputBox = sinon.stub(vscode.window, 'showInputBox').resolves('ignored');

    activateExtension();
    await vscode.commands.executeCommand('okteto.namespace');

    expect(createNamespace.called).to.equal(false);
    expect(setNamespace.called).to.equal(false);
    expect(showInputBox.called).to.equal(false);
  });
});

describe('down command (manifest picker dismissed)', () => {
  const mockVSCode = vscode as unknown as MockVSCode;

  beforeEach(() => {
    mockVSCode.__mock.reset();
    sinon.restore();
  });

  afterEach(() => {
    sinon.restore();
  });

  it('returns without invoking okteto.down when no manifests exist in the workspace', async () => {
    // Regression for getManifestOrAsk dismissed path. With an empty workspace
    // and no active manifest, showManifestPicker shows an error and returns
    // undefined; downCmd must exit without calling okteto.down.
    sinon.stub(okteto, 'needsInstall').resolves({ install: false, upgrade: false });
    sinon.stub(okteto, 'getContext').returns({ id: 'ctx', name: 'ctx', namespace: 'ns', isOkteto: true });
    sinon.stub(okteto, 'getMachineId').returns('machine-id');
    const downStub = sinon.stub(okteto, 'down').resolves();

    // The mock workspace.findFiles returns [] by default, so showManifestPicker
    // hits its "No manifests found" branch and returns undefined.
    sinon.stub(vscode.window, 'showErrorMessage').resolves(undefined);

    activateExtension();
    await vscode.commands.executeCommand('okteto.down');

    expect(downStub.called).to.equal(false);
  });

  it('invokes okteto.downAll when the all-services option is selected', async () => {
    sinon.stub(okteto, 'needsInstall').resolves({ install: false, upgrade: false });
    sinon.stub(okteto, 'getContext').returns({ id: 'ctx', name: 'ctx', namespace: 'ns', isOkteto: true });
    sinon.stub(okteto, 'getMachineId').returns('machine-id');

    const manifestUri = vscode.Uri.file('/workspace/okteto.yml');
    sinon.stub(vscode.workspace, 'findFiles').resolves([manifestUri]);
    sinon.stub(manifest, 'get').resolves(new manifest.Manifest([
      new manifest.Service('api', '/app', 0),
      new manifest.Service('worker', '/worker', 0),
    ], []));

    const downStub = sinon.stub(okteto, 'down').resolves();
    const downAllStub = sinon.stub(okteto, 'downAll').resolves();
    const withProgressStub = sinon.stub(vscode.window, 'withProgress').callsFake(async (options, task) => {
      expect(options.title).to.equal('Okteto: Running down');
      return task(
        { report: () => {} },
        { onCancellationRequested: () => ({ dispose: () => {} }) } as unknown as vscode.CancellationToken,
      ) as Promise<unknown>;
    });
    sinon.stub(vscode.window, 'showQuickPick').resolves({
      label: 'All services',
      target: { type: 'all' },
    } as vscode.QuickPickItem & { target: { type: 'all' } });
    const showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage').resolves(undefined);

    activateExtension();
    await vscode.commands.executeCommand('okteto.down');

    expect(downStub.called).to.equal(false);
    expect(withProgressStub.calledOnce).to.equal(true);
    expect(downAllStub.calledOnceWithExactly(manifestUri, 'ns', ['api', 'worker'])).to.equal(true);
    expect(showInformationMessageStub.calledOnce).to.equal(true);
    expect(showInformationMessageStub.firstCall.args[0]).to.equal('Okteto: Down completed');
  });
});

describe('isManifestSupported', () => {
  const supportedDeployFilenames = [
    'docker-compose.yml',
    'docker-compose.yaml',
    'okteto.yml',
    'okteto.yaml',
  ];

  const supportedUpFilenames = [
    'docker-compose.yml',
    'docker-compose.yaml',
    'okteto.yml',
    'okteto.yaml',
  ];

  describe('exact matches from supported list', () => {
    it('should accept exact matches from deploy list', () => {
      expect(isManifestSupported('okteto.yml', supportedDeployFilenames)).to.equal(true);
      expect(isManifestSupported('okteto.yaml', supportedDeployFilenames)).to.equal(true);
      expect(isManifestSupported('docker-compose.yml', supportedDeployFilenames)).to.equal(true);
      expect(isManifestSupported('docker-compose.yaml', supportedDeployFilenames)).to.equal(true);
    });

    it('should accept exact matches from up list', () => {
      expect(isManifestSupported('okteto.yml', supportedUpFilenames)).to.equal(true);
      expect(isManifestSupported('okteto.yaml', supportedUpFilenames)).to.equal(true);
      expect(isManifestSupported('docker-compose.yml', supportedUpFilenames)).to.equal(true);
      expect(isManifestSupported('docker-compose.yaml', supportedUpFilenames)).to.equal(true);
    });
  });

  describe('okteto-* pattern files', () => {
    it('should accept okteto-* patterns with any supported list', () => {
      expect(isManifestSupported('okteto-api.yml', supportedDeployFilenames)).to.equal(true);
      expect(isManifestSupported('okteto-api.yaml', supportedUpFilenames)).to.equal(true);
      expect(isManifestSupported('okteto-compose.yml', supportedDeployFilenames)).to.equal(true);
      expect(isManifestSupported('okteto-custom.yaml', supportedUpFilenames)).to.equal(true);
      expect(isManifestSupported('okteto-frontend.yml', supportedDeployFilenames)).to.equal(true);
      expect(isManifestSupported('okteto-backend.yaml', supportedUpFilenames)).to.equal(true);
    });
  });

  describe('okteto.* pattern files', () => {
    it('should accept okteto.* patterns with any supported list', () => {
      expect(isManifestSupported('okteto.dev.yml', supportedDeployFilenames)).to.equal(true);
      expect(isManifestSupported('okteto.dev.yaml', supportedUpFilenames)).to.equal(true);
      expect(isManifestSupported('okteto.staging.yml', supportedDeployFilenames)).to.equal(true);
      expect(isManifestSupported('okteto.prod.yaml', supportedUpFilenames)).to.equal(true);
      expect(isManifestSupported('okteto.local.yml', supportedDeployFilenames)).to.equal(true);
      expect(isManifestSupported('okteto.test.yaml', supportedUpFilenames)).to.equal(true);
    });
  });

  describe('invalid filenames', () => {
    it('should reject files that do not match any pattern', () => {
      expect(isManifestSupported('manifest.yml', supportedDeployFilenames)).to.equal(false);
      expect(isManifestSupported('config.yaml', supportedDeployFilenames)).to.equal(false);
      expect(isManifestSupported('docker.yml', supportedDeployFilenames)).to.equal(false);
      expect(isManifestSupported('okteto', supportedDeployFilenames)).to.equal(false);
      expect(isManifestSupported('okteto.txt', supportedDeployFilenames)).to.equal(false);
    });

    it('should reject files with wrong extensions', () => {
      expect(isManifestSupported('okteto.dev.json', supportedDeployFilenames)).to.equal(false);
      expect(isManifestSupported('okteto-api.txt', supportedDeployFilenames)).to.equal(false);
      expect(isManifestSupported('okteto.yaml.bak', supportedDeployFilenames)).to.equal(false);
    });
  });

  describe('edge cases', () => {
    it('should handle edge case patterns', () => {
      expect(isManifestSupported('okteto-.yml', supportedDeployFilenames)).to.equal(true);
      expect(isManifestSupported('okteto..yml', supportedDeployFilenames)).to.equal(true);
      expect(isManifestSupported('okteto-a-b-c.yml', supportedDeployFilenames)).to.equal(true);
      expect(isManifestSupported('okteto.a.b.c.yml', supportedDeployFilenames)).to.equal(true);
    });
  });

  describe('case sensitivity', () => {
    it('should be case-sensitive for exact matches', () => {
      expect(isManifestSupported('Okteto.yml', supportedDeployFilenames)).to.equal(false);
      expect(isManifestSupported('OKTETO.YML', supportedDeployFilenames)).to.equal(false);
      expect(isManifestSupported('Docker-Compose.yml', supportedDeployFilenames)).to.equal(false);
    });

    it('should be case-sensitive for pattern matches', () => {
      expect(isManifestSupported('Okteto-api.yml', supportedDeployFilenames)).to.equal(false);
      expect(isManifestSupported('OKTETO.dev.yml', supportedDeployFilenames)).to.equal(false);
      expect(isManifestSupported('okteto-Api.YML', supportedDeployFilenames)).to.equal(false);
    });
  });

  describe('empty and invalid inputs', () => {
    it('should handle empty filename', () => {
      expect(isManifestSupported('', supportedDeployFilenames)).to.equal(false);
      expect(isManifestSupported('', supportedUpFilenames)).to.equal(false);
    });

    it('should handle empty supported filenames array', () => {
      expect(isManifestSupported('okteto.yml', [])).to.equal(false);
      expect(isManifestSupported('okteto.dev.yml', [])).to.equal(true);
    });
  });
});

describe('getUpTimeoutSeconds', () => {
  const mockVSCode = vscode as unknown as MockVSCode;

  beforeEach(() => {
    mockVSCode.__mock.reset();
  });

  it('returns the package.json default (100) when the setting is not configured', () => {
    expect(getUpTimeoutSeconds()).to.equal(100);
  });

  it('returns the user-configured value when set', () => {
    mockVSCode.__mock.setConfiguration('okteto', 'upTimeout', 250);
    expect(getUpTimeoutSeconds()).to.equal(250);
  });

  it('falls back to 100 when the setting is 0 (treats falsy as "use default")', () => {
    mockVSCode.__mock.setConfiguration('okteto', 'upTimeout', 0);
    expect(getUpTimeoutSeconds()).to.equal(100);
  });

  it('does not read from the unrelated `okteto.timeout` key', () => {
    // Regression for round-1 fix: code used to read 'okteto.timeout' which
    // was never the documented setting. Putting a value under that key must
    // have no effect now.
    mockVSCode.__mock.setConfiguration('okteto', 'timeout', 7);
    expect(getUpTimeoutSeconds()).to.equal(100);
  });

  describe('malformed config values (settings.json edited by hand)', () => {
    it('falls back to 100 for a string value', () => {
      mockVSCode.__mock.setConfiguration('okteto', 'upTimeout', 'abc');
      expect(getUpTimeoutSeconds()).to.equal(100);
    });

    it('falls back to 100 for a negative number', () => {
      // Critical: an unvalidated negative would make `counter > upTimeoutSeconds`
      // true on the first iteration of the wait loop and produce a spurious
      // "process failed to start" before the dev container has any chance.
      mockVSCode.__mock.setConfiguration('okteto', 'upTimeout', -5);
      expect(getUpTimeoutSeconds()).to.equal(100);
    });

    it('falls back to 100 for NaN', () => {
      mockVSCode.__mock.setConfiguration('okteto', 'upTimeout', Number.NaN);
      expect(getUpTimeoutSeconds()).to.equal(100);
    });

    it('falls back to 100 for Infinity', () => {
      mockVSCode.__mock.setConfiguration('okteto', 'upTimeout', Number.POSITIVE_INFINITY);
      expect(getUpTimeoutSeconds()).to.equal(100);
    });

    it('falls back to 100 for a boolean', () => {
      mockVSCode.__mock.setConfiguration('okteto', 'upTimeout', true);
      expect(getUpTimeoutSeconds()).to.equal(100);
    });

    it('falls back to 100 for null', () => {
      mockVSCode.__mock.setConfiguration('okteto', 'upTimeout', null);
      expect(getUpTimeoutSeconds()).to.equal(100);
    });

    it('falls back to 100 for an object', () => {
      mockVSCode.__mock.setConfiguration('okteto', 'upTimeout', {seconds: 250});
      expect(getUpTimeoutSeconds()).to.equal(100);
    });

    it('accepts a positive float as-is', () => {
      mockVSCode.__mock.setConfiguration('okteto', 'upTimeout', 42.5);
      expect(getUpTimeoutSeconds()).to.equal(42.5);
    });
  });
});
