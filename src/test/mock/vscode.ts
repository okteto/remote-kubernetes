/**
 * Minimal vscode module mock for unit testing outside the VS Code extension host.
 * Loaded via mocha --require before tests run.
 */
import Module from 'module';

const configuration: Record<string, Record<string, unknown>> = {};
const registeredCommands = new Map<string, (...args: unknown[]) => unknown>();
const telemetryListeners = new Set<(enabled: boolean) => void>();

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
  vscodeStub.workspace.workspaceFolders = [];
  vscodeStub.env.isTelemetryEnabled = false;
}

const vscodeStub: Record<string, any> = {
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
    withProgress: async () => undefined,
    createTerminal: () => ({
      sendText: () => {},
      show: () => {},
      dispose: () => {},
    }),
    createOutputChannel: () => ({
      appendLine: () => {},
      append: () => {},
      clear: () => {},
      show: () => {},
      hide: () => {},
      dispose: () => {},
      info: () => {},
      debug: () => {},
      error: () => {},
      warn: () => {},
      trace: () => {},
    }),
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
    getRegisteredCommand: (command: string) => registeredCommands.get(command),
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
