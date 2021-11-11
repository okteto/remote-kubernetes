'use strict';

import * as vscode from 'vscode';
import * as manifest from './manifest';
import * as ssh from './ssh';
import * as okteto from './okteto';
import * as kubernetes from './kubernetes';
import {Reporter, events} from './telemetry';


const activeManifest = new Map<string, vscode.Uri>();
let reporter: Reporter;

export function activate(context: vscode.ExtensionContext) {
    let version = "0.0.0";
    const ex = vscode.extensions.getExtension('okteto.remote-kubernetes');
    if (ex) {
        version = ex.packageJSON.version;
    }

    console.log(`okteto.remote-kubernetes ${version} activated`);

    const ctx = okteto.getContext();
    const machineId = okteto.getMachineId();

    reporter = new Reporter(version, ctx.id, machineId);
    reporter.track(events.activated);

    context.subscriptions.push(vscode.commands.registerCommand('okteto.up', upCommand));
    context.subscriptions.push(vscode.commands.registerCommand('okteto.down', downCommand));
    context.subscriptions.push(vscode.commands.registerCommand('okteto.install', installCmd));
    context.subscriptions.push(vscode.commands.registerCommand('okteto.create', createCmd));
}

async function installCmd(upgrade: boolean, handleErr: boolean) {
    let title = "Installing Okteto";
    let success = `Okteto was successfully installed`;
    
    if (upgrade) {
        title = "Okteto is out of date, upgrading";
        success = `Okteto was successfully upgraded`;
    }

    console.log('installing okteto');
    reporter.track(events.install);
    await vscode.window.withProgress(
      {location: vscode.ProgressLocation.Notification, title: title},
      async () => {
        try {
            await okteto.install();
        } catch(err: any) {
            reporter.track(events.oktetoInstallFailed);
            reporter.captureError(`okteto install failed: ${err.message}`, err);
            if (handleErr) {
                vscode.window.showErrorMessage(`Okteto was not installed: ${err.message}`);
            } else {
                throw new Error(`Okteto was not installed: ${err.message}`);
            }
            
        }
      },
    );

    vscode.window.showInformationMessage(success);
}

async function upCommand(selectedManifestUri: vscode.Uri) {
    const { install, upgrade } = await okteto.needsInstall();
    if (install) {
        try {
            await installCmd(upgrade, false);
        } catch(err: any) {
            vscode.window.showErrorMessage(err.message);
            return;
        }
    }

    reporter.track(events.up);

    const manifestUri = selectedManifestUri || await showManifestPicker();
    if (!manifestUri) {
        reporter.track(events.manifestDismissed);
        return;
    }

    reporter.track(events.manifestSelected);
    const manifestPath = manifestUri.fsPath;
    console.log(`user selected: ${manifestPath}`);

    let m: manifest.Manifest;

    try {
        m = await manifest.getManifest(manifestPath);
    } catch(err: any) {
        reporter.track(events.manifestLoadFailed);
        reporter.captureError(`load manifest failed: ${err.message}`, err);
        return onOktetoFailed(`Okteto: Up failed to load your Okteto manifest: ${err.message}`);
    }

    const ctx = okteto.getContext();
    const kubeconfig = kubernetes.getKubeconfig();


    if (!m.namespace) {
        if (ctx.namespace != "") {
            m.namespace = ctx.namespace;
        }else {
            const ns = kubernetes.getCurrentNamespace(kubeconfig);
            if (!ns) {
                vscode.window.showErrorMessage("Couldn't detect your current Kubernetes context.");
                return;
            }
        
            m.namespace = ns;
        }
    }

    let port = m.port;
    if (port === 0 || port === undefined) {
        try {
            port = await ssh.getPort();
        } catch(err: any) {
            reporter.track(events.sshPortFailed);
            reporter.captureError(`ssh.getPort failed: ${err.message}`, err);
            return onOktetoFailed(`Okteto: Up failed to find an available port: ${err}`, `${m.namespace}-${m.name}`);
        }
    }    

    okteto.up(manifestPath, m.namespace, m.name, port, kubeconfig);
    activeManifest.set(`${m.namespace}-${m.name}`, manifestUri);

    try{
        await waitForUp(m.namespace, m.name, port);
    } catch(err: any) {
        reporter.captureError(`okteto up failed: ${err.message}`, err);
        return onOktetoFailed(err.message, `${m.namespace}-${m.name}`);
    }

    await finalizeUp(m.namespace,m.name, m.workdir);
}

async function waitForUp(namespace: string, name: string, port: number) {
    await vscode.window.withProgress(
        {location: vscode.ProgressLocation.Notification, cancellable: true },
          async (progress, token) => {
              token.onCancellationRequested(() => {
                  reporter.track(events.upCancelled);
                  vscode.commands.executeCommand('okteto.down');
              });

              const result = await waitForFinalState(namespace, name, progress);
              if (!result.result) {
                  reporter.track(events.oktetoUpFailed);
                  console.error(result.message);
                  throw new Error(`Okteto: Up command failed: ${result.message}`);
              }

              try {
                  await ssh.isReady(port);
              } catch(err: any) {
                  reporter.track(events.sshServiceFailed);
                  reporter.captureError(`SSH wasn't available after 60 seconds: ${err.message}`, err);
                  throw new Error(`Okteto: Up command failed, SSH server wasn't available after 60 seconds`);
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
        switch(res.state){
            case okteto.state.ready:
                return {result: true, message: ''};
            case okteto.state.failed:
                return {result: false, message: res.message};
            case okteto.state.starting:
                const isRunning = await okteto.isRunning(namespace, name);
                if (!isRunning && counter > 10){
                    return {result: false, message: `process failed to start`};
                }
        }
        
        counter++;
        if (counter === timeout) {
            return {result: false, message: `task didn't finish in 5 minutes`};
        }
        
        await sleep(1000);
    }
}

async function sleep(ms: number) {
    return new Promise<void>(resolve =>  setTimeout(resolve, 1000));
}

async function finalizeUp(namespace: string, name: string, workdir: string) {
    let folder = '/usr/src/app';
    if (workdir) {
        folder = workdir;
    }
    
    reporter.track(events.upReady);

    try {
        const remote = `${name}.okteto`;
        const uri = vscode.Uri.parse(`vscode-remote://ssh-remote+${remote}${folder}`);
        await vscode.commands.executeCommand('vscode.openFolder', uri, true);
        reporter.track(events.upFinished);
        okteto.notifyIfFailed(namespace, name, onOktetoFailed);
    } catch(err: any) {
        reporter.captureError(`opensshremotes.openEmptyWindow failed: ${err.message}`, err);
        reporter.track(events.sshHostSelectionFailed);
        return onOktetoFailed(`Okteto: Up failed to open the host selector: ${err.message}`, `${namespace}-${name}`);
    }
}

async function downCommand() {
    const { install, upgrade } = await okteto.needsInstall();
    if (install){
        try {
            await installCmd(upgrade, false);
        } catch(err: any){
            vscode.window.showErrorMessage(err.message);
            return;
        }
    }

    reporter.track(events.down);
    const manifestPath = await getManifestOrAsk();
    if (!manifestPath) {
        return;
    }

    let m: manifest.Manifest;

    try {
        m = await manifest.getManifest(manifestPath);
    } catch(err: any) {
        reporter.track(events.manifestLoadFailed);
        reporter.captureError(`load manifest failed: ${err.message}`, err);
        return onOktetoFailed(`Okteto: Down failed to load your Okteto manifest: ${err.message}`);
    }

    const kubeconfig = kubernetes.getKubeconfig();

    if (!m.namespace) {
        const ns = kubernetes.getCurrentNamespace(kubeconfig);
        if (!ns) {
            vscode.window.showErrorMessage("Couldn't detect your current Kubernetes context.");
            return;
        }
    
        m.namespace = ns;
    }

    try {
        await okteto.down(manifestPath, m.namespace, m.name, kubeconfig);
        activeManifest.delete(`${m.namespace}-${m.name}`);
        vscode.window.showInformationMessage("Okteto environment deactivated");
        reporter.track(events.downFinished);
    } catch(err: any) {
        reporter.track(events.oktetoDownFailed);
        reporter.captureError(`okteto down failed: ${err.message}`, err);
        vscode.window.showErrorMessage(`Okteto: Down failed: ${err.message}`);
    }
}

async function getManifestOrAsk(): Promise<string | undefined> {
    if (activeManifest.size > 0) {
        if (activeManifest.size === 1) {
            const manifestUri = activeManifest.values().next().value;
            return manifestUri.fsPath;
        } else {
          const manifestUri = await showActiveManifestPicker();
          if (manifestUri) {
            reporter.track(events.manifestSelected);
            return manifestUri.fsPath;
          } else {
            reporter.track(events.manifestDismissed);
          }
        }
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
            await installCmd(upgrade, false);
        } catch(err: any) {
            vscode.window.showErrorMessage(err.message);
            return;
        }
    }

    const manifestPath = manifest.getDefaultLocation();
    if (!manifestPath) {
        reporter.track(events.createFailed);
        vscode.window.showErrorMessage(`Okteto: Create failed: Couldn't detect your project's path`);
        return;
    }

    const choice = await vscode.window.showQuickPick(okteto.getLanguages(), {canPickMany: false, placeHolder: 'Select your development runtime'});
    if (!choice) {
        return;
    }

    try {
        await okteto.init(manifestPath, choice.value);
    } catch(err: any) {
        reporter.track(events.oktetoInitFailed);
        reporter.captureError(`okteto init failed: ${err.message}`, err);
        vscode.window.showErrorMessage(`Okteto: Create failed: ${err}`);
        return;
    }

    try {
        await vscode.commands.executeCommand('vscode.openFolder', manifestPath);
    } catch (err: any) {
        reporter.track(events.createOpenFailed);
        reporter.captureError(`open folder failed ${err.message}`, err);
        vscode.window.showErrorMessage(`Okteto: Create failed: Couldn't open ${manifestPath}`);
        return;
    }
}

function onOktetoFailed(message: string, terminalSuffix: string | null = null) {
    vscode.window.showErrorMessage(message);
    if (terminalSuffix) {
        okteto.showTerminal(terminalSuffix);
    }
}

async function showManifestPicker() : Promise<vscode.Uri | undefined> {
    const files = await vscode.workspace.findFiles('**/okteto.{yml,yaml}', '**/node_modules/**');
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

async function showActiveManifestPicker() : Promise<vscode.Uri | undefined> {
    const items: any[] = [];
    activeManifest.forEach((file, manifest) => {
        items.push({
            label: manifest,
            uri: file
        });
    });
    const manifestItem = await vscode.window.showQuickPick(items, {
        canPickMany: false,
        placeHolder: 'Select your okteto active manifest'
    });
    return manifestItem ? manifestItem.uri : undefined;
}
