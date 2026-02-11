/**
 * Minimal vscode module mock for unit testing outside the VS Code extension host.
 * Loaded via mocha --require before tests run.
 */
import Module from 'module';

const vscodeStub: Record<string, any> = {
  workspace: {
    getConfiguration: () => ({
      get: () => undefined,
    }),
    findFiles: async () => [],
    workspaceFolders: [],
  },
  window: {
    showErrorMessage: async () => undefined,
    showInformationMessage: async () => undefined,
    showQuickPick: async () => undefined,
    showInputBox: async () => undefined,
    withProgress: async () => undefined,
    createTerminal: () => ({
      sendText: () => {},
      show: () => {},
      dispose: () => {},
    }),
    terminals: [],
  },
  commands: {
    registerCommand: () => ({ dispose: () => {} }),
    executeCommand: async () => undefined,
    getCommands: async () => [],
  },
  extensions: {
    getExtension: () => undefined,
  },
  env: {
    machineId: 'test-machine-id',
    sessionId: 'test-session-id',
    isTelemetryEnabled: false,
    onDidChangeTelemetryEnabled: () => ({ dispose: () => {} }),
  },
  version: '1.109.0',
  Uri: {
    file: (p: string) => ({ fsPath: p, toString: () => p }),
    parse: (s: string) => ({ fsPath: s, toString: () => s }),
  },
  ThemeIcon: class ThemeIcon {
    constructor(public id: string) {}
  },
  ProgressLocation: {
    Notification: 15,
  },
  EventEmitter: class EventEmitter {
    event = () => ({ dispose: () => {} });
    fire() {}
    dispose() {}
  },
};

// Override Node's module resolution to intercept 'vscode' requires
const originalResolveFilename = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (
  request: string,
  parent: any,
  isMain: boolean,
  options: any,
) {
  if (request === 'vscode') {
    // Return a sentinel that we intercept in _load
    return 'vscode';
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const originalLoad = (Module as any)._load;
(Module as any)._load = function (request: string, parent: any, isMain: boolean) {
  if (request === 'vscode') {
    return vscodeStub;
  }
  return originalLoad.call(this, request, parent, isMain);
};
