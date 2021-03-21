import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as okteto from './okteto';
import * as kubernetes from './kubernetes';

function onOktetoFailed(message: string) {
  vscode.window.showErrorMessage(message);
  okteto.showTerminal();
}

async function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, 1000));
}

async function waitForUp(namespace: string, name: string) {
  await vscode.window.withProgress(
    {location: vscode.ProgressLocation.Notification, cancellable: true },
      async (progress, token) => {
          token.onCancellationRequested(() => {
              vscode.commands.executeCommand('okteto.down');
          });

          const result = await waitForFinalState(namespace, name, progress);
          if (!result.result) {
              console.error(result.message);
              throw new Error(`Okteto: Up command failed: ${result.message}`);
          }
      });
}

async function waitForFinalState(namespace: string, name:string, progress: vscode.Progress<{message?: string | undefined; increment?: number | undefined}>): Promise<{result: boolean, message: string}> {
  const seen = new Map<string, boolean>();
  const messages = okteto.getStateMessages();
  progress.report({  message: "Launching your development environment..." });
  var counter = 0;
  var timeout = 5 * 60; // 5 minutes
  while (true) {
    const res = await okteto.getState(namespace, name);
    if (!seen.has(res.state)) {
      progress.report({ message: messages.get(res.state) });
      console.log(`okteto is ${res.state}`);
    }

    seen.set(res.state, true);

    if (okteto.state.ready === res.state) {
      return {result: true, message: ''};
    } else if(okteto.state.failed === res.state) {
      return {result: false, message: res.message};
    }

    counter++;
    if (counter === timeout) {
      return {result: false, message: `task didn't finish in 5 minutes`};
    }

    await sleep(1000);
  }
}

async function finalizeUp(namespace: string, name: string) {
  okteto.notifyIfFailed(namespace, name, onOktetoFailed);
  vscode.window.showInformationMessage("Your development container is ready!");
}

export class DevContainersProvider implements vscode.TreeDataProvider<Manifest> {
  constructor(private workspaceRoot: string, public context: vscode.ExtensionContext) {}

  getTreeItem(element: Manifest): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: Manifest): Promise<Manifest[]> {
    if (!this.workspaceRoot) {
      vscode.window.showInformationMessage('No okteto.yml in empty workspace');
      return Promise.resolve([]);
    }

    if (element) {
      return Promise.resolve([]); // This returns the children of a selected item.
    } else {
      const files = await vscode.workspace.findFiles('**/okteto.{yml,yaml}', '**/node_modules/**');
      const items = files.map(file => {
        return new Manifest(
          file,
          this.context,
          vscode.TreeItemCollapsibleState.None,
        );
      });
      if (files.length === 0) {
        vscode.window.showInformationMessage('Workspace has no package.json');
        return Promise.resolve([]);
      }
      return Promise.resolve(items);
    }
  }

  private _onDidChangeTreeData: vscode.EventEmitter<Manifest | undefined | null | void> =
    new vscode.EventEmitter<Manifest | undefined | null | void>();

  readonly onDidChangeTreeData: vscode.Event<Manifest | undefined | null | void> =
    this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  private pathExists(p: string): boolean {
    try {
      fs.accessSync(p);
    } catch (err) {
      return false;
    }
    return true;
  }
}

export class Manifest extends vscode.TreeItem {
  public content: any;
  private file: vscode.Uri;

  constructor(
    file: vscode.Uri,
    public context: vscode.ExtensionContext,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super('', collapsibleState);
    const manifest = yaml.load(fs.readFileSync(file.fsPath, 'utf8'));
    this.content = manifest;
    this.file = file;
    this.label = manifest?.name ? manifest.name : vscode.workspace.asRelativePath(file, true);
    this.tooltip = `${this.label}`;
    this.description = '';
  }

  async up(): Promise<void> {
    const manifestPath = this.file.fsPath;

    // 1. Install or upgrade okteto cli.
    const { install, upgrade } = await okteto.needsInstall();
    if (install) {
      vscode.commands.executeCommand('okteto.install');
    }

    // 2. Get Kubernetes context.
    const kubeconfig = kubernetes.getKubeconfig();
    if (!this.content.namespace) {
      const namespace = kubernetes.getCurrentNamespace(kubeconfig);
      if (!namespace) {
          vscode.window.showErrorMessage("Couldn't detect your current Kubernetes context.");
          return;
      }
      this.content.namespace = namespace;
    }

    // 3. Set up developer container.
    okteto.up(manifestPath, this.content.namespace, this.content.name, kubeconfig);
    try{
        await waitForUp(this.content.namespace, this.content.name);
    } catch(err) {
        return onOktetoFailed(err.message);
    }
    await finalizeUp(this.content.namespace, this.content.name);
  }

  iconPath = {
    light: this.context.asAbsolutePath(path.join('resources', 'light', 'container.svg')),
    dark: this.context.asAbsolutePath(path.join('resources', 'dark', 'container.svg'))
  };

  contextValue = 'manifest';
}
