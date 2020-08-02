import * as vscode from 'vscode';
import * as manifest from './manifest';
import * as okteto from './okteto';
import * as kubernetes from './kubernetes';
import {Reporter, events} from './telemetry';


let activeManifest: string;
let reporter: Reporter;

export function activate(context: vscode.ExtensionContext) {
    let version = "0.0.0";
    const ex = vscode.extensions.getExtension('okteto.remote-kubernetes');
    if (ex) {
        version = ex.packageJSON.version;
    }

    console.log(`okteto.remote-kubernetes ${version} activated`);

    const oktetoID = okteto.getOktetoId() || "";
    reporter = new Reporter(version, oktetoID);
    reporter.track(events.activated);

    context.subscriptions.push(vscode.commands.registerCommand('okteto.up', upCommand));
    context.subscriptions.push(vscode.commands.registerCommand('okteto.down', downCommand));
    context.subscriptions.push(vscode.commands.registerCommand('okteto.install', installCmd));
    context.subscriptions.push(vscode.commands.registerCommand('okteto.create', createCmd));

    // Register URI.
    // vscode://okteto.remote-kubernetes/connect?host=localhost&port=22000&name=frontend
    vscode.window.registerUriHandler({
      async handleUri(uri: vscode.Uri) {
        const { path, query } = uri;
        const [ command ] = path.split('/').filter(Boolean);
        console.log('Call from outside!');
        if (command === 'connect') {
          // const { host, port, name } = querystring.parse(query);
          // if (host) {
          //   await addNewHost(<string>host, <string>port, <string>name);
          //   vscode.commands.executeCommand("opensshremotes.openEmptyWindow", {
          //     host: name
          //   });
          // }
          console.log('Connected!');
        }
      }
    });
}

async function installCmd(upgrade: boolean) {
    let title = "Installing Okteto";
    if (upgrade) {
        title = "Okteto is out of date, upgrading";
    }

    reporter.track(events.install);
    await vscode.window.withProgress(
      {location: vscode.ProgressLocation.Notification, title: title},
      async () => {
        try {
            await okteto.install();
            if (upgrade) {
                vscode.window.showInformationMessage(`Okteto was successfully upgraded`);
            } else {
                vscode.window.showInformationMessage(`Okteto was successfully installed`);
            }
        } catch (err) {
            reporter.track(events.oktetoInstallFailed);
            reporter.captureError(err.message, err);
            vscode.window.showErrorMessage(`Okteto was not installed: ${err.message}`);
        }
      },
    );
}

async function upCommand(selectedManifestUri: vscode.Uri) {
    const { install, upgrade } = await okteto.needsInstall();
    if (install) {
        try {
            await installCmd(upgrade);
        } catch(err) {
            // Error already handled on installCmd.
            return;
        }
    }

    reporter.track(events.up);

    const ktx = kubernetes.getCurrentContext();
    if (!ktx) {
        vscode.window.showErrorMessage('Couldn\'t detect your current Kubernetes context.');
        return;
    }

    const manifestUri = selectedManifestUri || await showManifestPicker();
    if (!manifestUri) {
        reporter.track(events.manifestDismissed);
        return;
    }

    reporter.track(events.manifestSelected);
    const manifestPath = manifestUri.fsPath;
    console.log(`user selected: ${manifestPath}`);

    let name: any;
    let workdir: any;
    let port: number;

    try {
        const m = await manifest.getManifest(manifestPath);
        name = m.name;
        workdir = m.workdir;
    } catch (err) {
        reporter.track(events.manifestLoadFailed);
        reporter.captureError(`failed to load the manifest: ${err.message}`, err);
        return onOktetoFailed(`Okteto: Up failed to load your Okteto manifest: ${err.message}`);
    }

    okteto.start(manifestPath, ktx.namespace, name);
    activeManifest = manifestPath;

    try {
        await waitForUp(ktx.namespace, name);
    } catch(err) {
        return onOktetoFailed(err.message);
    }

    await finalizeUp(ktx.namespace, name, workdir);
}

async function waitForUp(namespace: string, name: string, port: number|null = null) {
    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            cancellable: true
        },
        async (progress, token) => {
            token.onCancellationRequested(() => {
                reporter.track(events.upCancelled);
                vscode.commands.executeCommand('okteto.down');
            });

            const success = await waitForFinalState(namespace, name, progress);
            if (!success) {
                reporter.track(events.oktetoUpFailed);
                throw new Error(`Okteto: Up command failed to start your development container`);
            }
        });
}

async function waitForFinalState(namespace: string, name:string, progress: vscode.Progress<{message?: string | undefined; increment?: number | undefined}>): Promise<boolean> {
    const seen = new Map<string, boolean>();
    const messages = okteto.getStateMessages();
    progress.report({  message: "Launching your development environment..." });
    while (true) {
        const state = okteto.getState(namespace, name);
        if (!seen.has(state)) {
            progress.report({ message: messages.get(state) });
            console.log(`okteto is ${state}`);
        }

        seen.set(state, true);

        if (okteto.state.ready === state) {
            return true;
        } else if(okteto.state.failed === state) {
            return false;
        }

        await sleep(1000);
    }
}

async function sleep(ms: number) {
    return new Promise<void>(resolve =>  setTimeout(resolve, 1000));
}

async function finalizeUp(namespace: string, name: string, workdir: string) {
    let folder = '/okteto';
    if (workdir) {
        folder = workdir;
    }
    reporter.track(events.upReady);
    okteto.notifyIfFailed(namespace, name, onOktetoFailed);
    vscode.window.showInformationMessage(`Your development container is ready!`);
}

async function downCommand() {
    const { install, upgrade } = await okteto.needsInstall();
    if (install){
        try {
            await installCmd(upgrade);
        } catch {
            // error already handled on installCmd
            return;
        }
    }

    reporter.track(events.down);
    const manifestPath = await getManifestOrAsk();
    if (!manifestPath) {
        return;
    }

    const ktx = kubernetes.getCurrentContext();
    if (!ktx) {
        vscode.window.showErrorMessage("Couldn't detect your current Kubernetes context.");
        return;
    }


    let name: string;

    try {
        const m = await manifest.getManifest(manifestPath);
        name =  m.name;
    } catch (err) {
        reporter.track(events.manifestLoadFailed);
        reporter.captureError(err.message, err);
        vscode.window.showErrorMessage(`Okteto: Down failed: ${err.message}`);
        return;
    }

    try {
        await okteto.down(manifestPath);
        activeManifest = '';
        vscode.window.showInformationMessage("Okteto environment deactivated");
        reporter.track(events.downFinished);
    } catch (err) {
        reporter.track(events.oktetoDownFailed);
        reporter.captureError(err.message, err);
        vscode.window.showErrorMessage(`Okteto: Down failed: ${err.message}`);
    }
}

async function getManifestOrAsk(): Promise<string | undefined> {
    if (activeManifest) {
        return activeManifest;
    } else {
        const manifestUri = await showManifestPicker();
        if (manifestUri) {
            reporter.track(events.manifestSelected);
            return manifestUri.fsPath;
        } else {
            reporter.track(events.manifestDismissed);
        }
    }
}

async function createCmd(){
    reporter.track(events.create);

    const { install, upgrade } = await okteto.needsInstall();
    if (install) {
        try {
            await installCmd(upgrade);
        } catch(err) {
            // error already handled on installCmd
            return;
        }
    }

    const manifestPath = manifest.getDefaultLocation();
    if (!manifestPath) {
        reporter.track(events.createFailed);
        vscode.window.showErrorMessage("Couldn't detect your project's path.");
        return;
    }

    const choice = await vscode.window.showQuickPick(okteto.getLanguages(), {canPickMany: false, placeHolder: 'Select your development runtime'});
    if (!choice) {
        return;
    }

    try {
        await okteto.init(manifestPath, choice.value);
    } catch (err) {
        reporter.track(events.oktetoInitFailed);
        reporter.captureError(err.message, err);
        vscode.window.showErrorMessage("Couldn't generate your manifest file.");
        return;
    }

    try {
        await vscode.commands.executeCommand('vscode.openFolder', manifestPath);
    } catch (err) {
        reporter.track(events.createOpenFailed);
        reporter.captureError(err.message, err);
        vscode.window.showErrorMessage(`Couldn't open ${manifestPath}: ${err}.`);
        return;
    }
}

function onOktetoFailed(message: string) {
    vscode.window.showErrorMessage(message);
    okteto.showTerminal();
}

async function showManifestPicker() : Promise<vscode.Uri | undefined> {
    const files = await vscode.workspace.findFiles('**/okteto.yml', '**/node_modules/**');
    if (files.length === 0) {
        await vscode.window.showErrorMessage(`No manifests found in your workspace.\n
Please run the 'Okteto: Create Manifest' command to create it and then try again.`, {
            modal: true
        });
        return;
    }
    const items = files.map(file => {
        return {
            label: vscode.workspace.asRelativePath(file, true),
            uri: file
        };
    });
    const manifestItem = await vscode.window.showQuickPick(items, {
        canPickMany: false,
        placeHolder: 'Select your okteto manifest'
    });
    return manifestItem ? manifestItem.uri : undefined;
}
