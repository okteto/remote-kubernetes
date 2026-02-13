'use strict';

import { expect } from 'chai';
import sinon from 'sinon';
import * as vscode from 'vscode';
import * as telemetry from '../../telemetry';
import * as okteto from '../../okteto';
import { isManifestSupported } from '../../extension';
import { isManifestSupported } from '../../extension';

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

describe('isManifestSupported', () => {
  const supportedDeployFilenames = [
    'okteto-pipeline.yml',
    'okteto-pipeline.yaml',
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
      expect(isManifestSupported('okteto-pipeline.yml', supportedDeployFilenames)).to.equal(true);
      expect(isManifestSupported('okteto-pipeline.yaml', supportedDeployFilenames)).to.equal(true);
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
      expect(isManifestSupported('okteto-stack.yml', supportedDeployFilenames)).to.equal(true);
      expect(isManifestSupported('okteto-stack.yaml', supportedUpFilenames)).to.equal(true);
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
      expect(isManifestSupported('okteto-stack.txt', supportedDeployFilenames)).to.equal(false);
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
      expect(isManifestSupported('Okteto-stack.yml', supportedDeployFilenames)).to.equal(false);
      expect(isManifestSupported('OKTETO.dev.yml', supportedDeployFilenames)).to.equal(false);
      expect(isManifestSupported('okteto-Stack.YML', supportedDeployFilenames)).to.equal(false);
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

describe('isManifestSupported', () => {
  const supportedDeployFilenames = [
    'okteto-pipeline.yml',
    'okteto-pipeline.yaml',
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

  describe('with allowPatterns=true (deploy commands)', () => {
    it('should accept exact matches from supported list', () => {
      expect(isManifestSupported('okteto.yml', supportedDeployFilenames, true)).to.equal(true);
      expect(isManifestSupported('okteto.yaml', supportedDeployFilenames, true)).to.equal(true);
      expect(isManifestSupported('okteto-pipeline.yml', supportedDeployFilenames, true)).to.equal(true);
      expect(isManifestSupported('okteto-pipeline.yaml', supportedDeployFilenames, true)).to.equal(true);
      expect(isManifestSupported('docker-compose.yml', supportedDeployFilenames, true)).to.equal(true);
      expect(isManifestSupported('docker-compose.yaml', supportedDeployFilenames, true)).to.equal(true);
    });

    it('should accept okteto-* pattern files', () => {
      expect(isManifestSupported('okteto-stack.yml', supportedDeployFilenames, true)).to.equal(true);
      expect(isManifestSupported('okteto-stack.yaml', supportedDeployFilenames, true)).to.equal(true);
      expect(isManifestSupported('okteto-compose.yml', supportedDeployFilenames, true)).to.equal(true);
      expect(isManifestSupported('okteto-custom.yaml', supportedDeployFilenames, true)).to.equal(true);
      expect(isManifestSupported('okteto-frontend.yml', supportedDeployFilenames, true)).to.equal(true);
      expect(isManifestSupported('okteto-backend.yaml', supportedDeployFilenames, true)).to.equal(true);
    });

    it('should accept okteto.* pattern files', () => {
      expect(isManifestSupported('okteto.dev.yml', supportedDeployFilenames, true)).to.equal(true);
      expect(isManifestSupported('okteto.dev.yaml', supportedDeployFilenames, true)).to.equal(true);
      expect(isManifestSupported('okteto.staging.yml', supportedDeployFilenames, true)).to.equal(true);
      expect(isManifestSupported('okteto.prod.yaml', supportedDeployFilenames, true)).to.equal(true);
      expect(isManifestSupported('okteto.local.yml', supportedDeployFilenames, true)).to.equal(true);
      expect(isManifestSupported('okteto.test.yaml', supportedDeployFilenames, true)).to.equal(true);
    });

    it('should reject files that do not match any pattern', () => {
      expect(isManifestSupported('manifest.yml', supportedDeployFilenames, true)).to.equal(false);
      expect(isManifestSupported('config.yaml', supportedDeployFilenames, true)).to.equal(false);
      expect(isManifestSupported('docker.yml', supportedDeployFilenames, true)).to.equal(false);
      expect(isManifestSupported('okteto', supportedDeployFilenames, true)).to.equal(false);
      expect(isManifestSupported('okteto.txt', supportedDeployFilenames, true)).to.equal(false);
    });

    it('should reject files with wrong extensions', () => {
      expect(isManifestSupported('okteto.dev.json', supportedDeployFilenames, true)).to.equal(false);
      expect(isManifestSupported('okteto-stack.txt', supportedDeployFilenames, true)).to.equal(false);
      expect(isManifestSupported('okteto.yaml.bak', supportedDeployFilenames, true)).to.equal(false);
    });

    it('should handle edge cases', () => {
      expect(isManifestSupported('okteto-.yml', supportedDeployFilenames, true)).to.equal(true);
      expect(isManifestSupported('okteto..yml', supportedDeployFilenames, true)).to.equal(true);
      expect(isManifestSupported('okteto-a-b-c.yml', supportedDeployFilenames, true)).to.equal(true);
      expect(isManifestSupported('okteto.a.b.c.yml', supportedDeployFilenames, true)).to.equal(true);
    });
  });

  describe('with allowPatterns=false (up commands)', () => {
    it('should accept exact matches from supported list', () => {
      expect(isManifestSupported('okteto.yml', supportedUpFilenames, false)).to.equal(true);
      expect(isManifestSupported('okteto.yaml', supportedUpFilenames, false)).to.equal(true);
      expect(isManifestSupported('docker-compose.yml', supportedUpFilenames, false)).to.equal(true);
      expect(isManifestSupported('docker-compose.yaml', supportedUpFilenames, false)).to.equal(true);
    });

    it('should reject okteto-* pattern files', () => {
      expect(isManifestSupported('okteto-pipeline.yml', supportedUpFilenames, false)).to.equal(false);
      expect(isManifestSupported('okteto-stack.yml', supportedUpFilenames, false)).to.equal(false);
      expect(isManifestSupported('okteto-compose.yaml', supportedUpFilenames, false)).to.equal(false);
    });

    it('should reject okteto.* pattern files', () => {
      expect(isManifestSupported('okteto.dev.yml', supportedUpFilenames, false)).to.equal(false);
      expect(isManifestSupported('okteto.staging.yaml', supportedUpFilenames, false)).to.equal(false);
      expect(isManifestSupported('okteto.prod.yml', supportedUpFilenames, false)).to.equal(false);
    });

    it('should reject any files not in exact supported list', () => {
      expect(isManifestSupported('manifest.yml', supportedUpFilenames, false)).to.equal(false);
      expect(isManifestSupported('config.yaml', supportedUpFilenames, false)).to.equal(false);
      expect(isManifestSupported('okteto.txt', supportedUpFilenames, false)).to.equal(false);
    });
  });

  describe('case sensitivity', () => {
    it('should be case-sensitive for exact matches', () => {
      expect(isManifestSupported('Okteto.yml', supportedDeployFilenames, true)).to.equal(false);
      expect(isManifestSupported('OKTETO.YML', supportedDeployFilenames, true)).to.equal(false);
      expect(isManifestSupported('Docker-Compose.yml', supportedDeployFilenames, true)).to.equal(false);
    });

    it('should be case-sensitive for pattern matches', () => {
      expect(isManifestSupported('Okteto-stack.yml', supportedDeployFilenames, true)).to.equal(false);
      expect(isManifestSupported('OKTETO.dev.yml', supportedDeployFilenames, true)).to.equal(false);
      expect(isManifestSupported('okteto-Stack.YML', supportedDeployFilenames, true)).to.equal(false);
    });
  });

  describe('empty and invalid inputs', () => {
    it('should handle empty filename', () => {
      expect(isManifestSupported('', supportedDeployFilenames, true)).to.equal(false);
      expect(isManifestSupported('', supportedUpFilenames, false)).to.equal(false);
    });

    it('should handle empty supported filenames array', () => {
      expect(isManifestSupported('okteto.yml', [], true)).to.equal(false);
      expect(isManifestSupported('okteto.yml', [], false)).to.equal(false);
      expect(isManifestSupported('okteto.dev.yml', [], true)).to.equal(true);
    });
  });
});
