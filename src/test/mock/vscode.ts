/**
 * Minimal vscode module mock for unit testing outside the VS Code extension host.
 * Loaded via mocha --require before tests run.
 */
import Module from 'module';

const configuration: Record<string, Record<string, unknown>> = {};
const registeredCommands = new Map<string, (...args: unknown[]) => unknown>();
const telemetryListeners = new Set<(enabled: boolean) => void>();
const outputChannels: Array<{name: string; disposed: boolean; dispose: () => void}> = [];

type ModuleInternals = typeof Module & {
  _resolveFilename: (
    request: string,
    parent: unknown,
    isMain: boolean,
    options: unknown,
  ) => string;
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};

type MockWorkspace = {
  getConfiguration: (section: string) => { get: (key: string) => unknown };
  findFiles: () => Promise<unknown[]>;
  workspaceFolders: unknown[];
};

type MockEnv = {
  machineId: string;
  sessionId: string;
  isTelemetryEnabled: boolean;
  shell: string | undefined;
  onDidChangeTelemetryEnabled: (listener: (enabled: boolean) => void) => { dispose: () => void };
};

type MockVscode = {
  workspace: MockWorkspace;
  window: Record<string, unknown> & { terminals: Array<{ name: string }> };
  commands: Record<string, unknown>;
  extensions: Record<string, unknown>;
  env: MockEnv;
  version: string;
  Uri: Record<string, unknown>;
  ThemeIcon: unknown;
  ProgressLocation: Record<string, unknown>;
  EventEmitter: unknown;
  __mock: Record<string, unknown>;
};

function getConfigValue(section: string, key: string): unknown {
  return configuration[section]?.[key];
}

function setConfigValue(section: string, key: string, value: unknown): void {
  if (!configuration[section]) {
    configuration[section] = {};
  }
  configuration[section][key] = value;
}

function resetMockState(): void {
  for (const section of Object.keys(configuration)) {
    delete configuration[section];
  }
  registeredCommands.clear();
  telemetryListeners.clear();
  outputChannels.length = 0;
  vscodeStub.workspace.workspaceFolders = [];
  vscodeStub.env.isTelemetryEnabled = false;
  vscodeStub.env.shell = undefined;
}

const vscodeStub: MockVscode = {
  workspace: {
    getConfiguration: (section: string) => ({
      get: (key: string) => getConfigValue(section, key),
    }),
    findFiles: async () => [],
    workspaceFolders: [],
  },
  window: {
    showErrorMessage: async () => undefined,
    showInformationMessage: async () => undefined,
    showQuickPick: async () => undefined,
    showInputBox: async () => undefined,
    withProgress: async (_options: unknown, task: (progress: unknown, token: unknown) => unknown) => task(
      { report: () => {} },
      { onCancellationRequested: () => ({ dispose: () => {} }) },
    ),
    createTerminal: () => ({
      sendText: () => {},
      show: () => {},
      dispose: () => {},
    }),
    createOutputChannel: (name: string) => {
      const channel = {
        name,
        disposed: false,
        appendLine: () => {},
        append: () => {},
        clear: () => {},
        show: () => {},
        hide: () => {},
        info: () => {},
        debug: () => {},
        error: () => {},
        warn: () => {},
        trace: () => {},
        dispose: function () { this.disposed = true; },
      };
      outputChannels.push(channel);
      return channel;
    },
    terminals: [],
  },
  commands: {
    registerCommand: (command: string, callback: (...args: unknown[]) => unknown) => {
      registeredCommands.set(command, callback);
      return {
        dispose: () => {
          registeredCommands.delete(command);
        },
      };
    },
    executeCommand: async (command: string, ...args: unknown[]) => {
      const callback = registeredCommands.get(command);
      if (!callback) {
        return undefined;
      }
      return callback(...args);
    },
    getCommands: async () => [],
  },
  extensions: {
    getExtension: () => undefined,
  },
  env: {
    machineId: 'test-machine-id',
    sessionId: 'test-session-id',
    isTelemetryEnabled: false,
    shell: undefined as string | undefined,
    onDidChangeTelemetryEnabled: (listener: (enabled: boolean) => void) => {
      telemetryListeners.add(listener);
      return {
        dispose: () => {
          telemetryListeners.delete(listener);
        },
      };
    },
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
  __mock: {
    reset: () => resetMockState(),
    setConfiguration: (section: string, key: string, value: unknown) => {
      setConfigValue(section, key, value);
    },
    emitTelemetryEnabledChanged: (enabled: boolean) => {
      vscodeStub.env.isTelemetryEnabled = enabled;
      telemetryListeners.forEach((listener) => listener(enabled));
    },
    setShell: (shellPath: string | undefined) => {
      vscodeStub.env.shell = shellPath;
    },
    getRegisteredCommand: (command: string) => registeredCommands.get(command),
    getOutputChannels: () => outputChannels.slice(),
  },
};

// Override Node's module resolution to intercept 'vscode' requires
const moduleInternals = Module as ModuleInternals;
const originalResolveFilename = moduleInternals._resolveFilename;
moduleInternals._resolveFilename = function (
  request: string,
  parent: unknown,
  isMain: boolean,
  options: unknown,
) {
  if (request === 'vscode') {
    // Return a sentinel that we intercept in _load
    return 'vscode';
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const originalLoad = moduleInternals._load;
moduleInternals._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'vscode') {
    return vscodeStub;
  }
  return originalLoad.call(this, request, parent, isMain);
};
