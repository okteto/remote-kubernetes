'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as manifest from './manifest';
import * as ssh from './ssh';
import * as okteto from './okteto';
import * as kubernetes from './kubernetes';
import {Reporter, events} from './telemetry';

let activeManifest: string;
let reporter: Reporter;
const mpToken = '564133a36e3c39ecedf700669282c315';

export function activate(context: vscode.ExtensionContext) {
    let version = "0.0.0";
    const ex = vscode.extensions.getExtension('okteto.remote-kubernetes');
    if (ex) {
        version = ex.packageJSON.version;
    }

    console.log(`okteto.remote-kubernetes ${version} activated`);

    const oktetoID = okteto.getOktetoId() || "";
    reporter = new Reporter(mpToken, version, oktetoID);
    reporter.track(events.activated);

    context.subscriptions.push(vscode.commands.registerCommand('okteto.up', upCommand));
    context.subscriptions.push(vscode.commands.registerCommand('okteto.down', downCommand));
    context.subscriptions.push(vscode.commands.registerCommand('okteto.install', installCmd));
    context.subscriptions.push(vscode.commands.registerCommand('okteto.create', createCmd));
}

function installCmd(upgrade: boolean): Promise<string> {
    let title = "Installing Okteto";
    if (upgrade) {
        title = "Okteto is out of date, upgrading";
    }

    return new Promise<string>((resolve, reject) => {
        vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: title,
    }, (progress, token)=>{
        reporter.track(events.install);
        const p = install();
        p.then(() => {
            //vscode.window.showInformationMessage(`Okteto was successfully installed`);
            resolve();
        }, (reason) => {
            reporter.track(events.oktetoInstallFailed);
            vscode.window.showErrorMessage(`Okteto was not installed: ${reason.message}`);
            reject();
        }
        );
        return p;
    });
  });
}

function install(): Promise<string>{
    return new Promise((resolve, reject) => {
        okteto.install()
        .then(()=>{
            console.log("okteto was successfully installed");
            resolve();
        }, (reason) => {
            console.error(`okteto was not installed: ${reason}`);
            throw new Error(reason);
        }).catch((reason) => {
            console.error(`okteto was not installed: ${reason}`);
            reject();
        });
    });
}

async function downCommand() {
    reporter.track(events.down);
    const { install, upgrade } = okteto.needsInstall();
    if (install){
        await installCmd(upgrade);
    }
    const manifestPath = await getManifestOrAsk();
    if (manifestPath) {
        await down(manifestPath);
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

async function down(manifestPath: string) {
    const ktx = kubernetes.getCurrentContext();
    if (!ktx) {
        vscode.window.showErrorMessage("Couldn't detect your current Kubernetes context.");
        return;
    }

    manifest.getName(manifestPath).then((name) => {
        okteto.down(manifestPath, ktx.namespace, name).then((e) =>{
            if (e.failed) {
                reporter.track(events.oktetoDownFailed);
                vscode.window.showErrorMessage(`Command failed: ${e.stderr}`);
            }

            activeManifest = '';
            vscode.window.showInformationMessage("Okteto environment deactivated");
            console.log(`okteto environment deactivated`);
            reporter.track(events.downFinished);
        });
    }, (reason) => {
        reporter.track(events.manifestLoadFailed);
        vscode.window.showErrorMessage(`Command failed: ${reason.message}`);
    });
}

async function upCommand() {
    reporter.track(events.up);
    const { install, upgrade } = okteto.needsInstall();
    if (install) {
        await installCmd(upgrade);
    }
    up();
}

function createCmd(){
    reporter.track(events.create);

    const manifestPath = manifest.getDefaultLocation();
    if (!manifestPath) {
        reporter.track(events.createFailed);
        vscode.window.showErrorMessage("Couldn't detect your project's path.");
        return;
    }

    vscode.window.showQuickPick(okteto.getLanguages(),
     {canPickMany: false, placeHolder: 'Select your development runtime'})
    .then((choice) => {
        if (!choice) {
            return;
        }

        if (!okteto.init(manifestPath, choice.value)) {
            reporter.track(events.oktetoInitFailed);
            vscode.window.showErrorMessage("Couldn't generate your manifest file.");
            return;
        }

        vscode.commands.executeCommand('vscode.openFolder', manifestPath)
        .then(()=>{
            reporter.track(events.createFinished);
        }, (err) => {
            reporter.track(events.createOpenFailed);
            vscode.window.showErrorMessage(`Couldn't open ${manifestPath}: ${err}.`);
        });
    });
}

async function up() {
    const manifestUri = await showManifestPicker();
    if (!manifestUri) {
        reporter.track(events.manifestDismissed);
        return;
    }

    reporter.track(events.manifestSelected);
    const manifestPath = manifestUri.fsPath;
    console.log(`user selected: ${manifestPath}`);
    manifest.getName(manifestPath)
    .then((name) => {
        const ktx = kubernetes.getCurrentContext();
        if (!ktx) {
            vscode.window.showErrorMessage("Couldn't detect your current Kubernetes context.");
            return;
        }

        ssh.getPort()
        .then((port) => {
            okteto.start(manifestPath, ktx.namespace, name, port)
            .then(()=>{
                activeManifest = manifestPath;
                waitForUp(ktx.namespace, name, port);
            }, (reason) => {
                reporter.track(events.oktetoUpStartFailed);
                console.error(`okteto.start failed: ${reason.message}`);
                onOktetoFailed(`Okteto: Up command failed to start your development environment: ${reason}`);
            });
        }, (reason) => {
            reporter.track(events.sshPortFailed);
            console.error(`ssh.getPort failed: ${reason.message}`);
            onOktetoFailed(`Okteto: Up command failed to find an available port: ${reason}`);
        });

    }, (reason) =>{
        reporter.track(events.manifestLoadFailed);
        console.error(`failed to load the manifest: ${reason.message}`);
        onOktetoFailed(`Okteto: Up command failed to load your Okteto manifest: ${reason}`);
    });
}

function waitForUp(namespace: string, name: string, port: number) {
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        cancellable: true
    }, (progress, token) => {
        token.onCancellationRequested(() => {
            reporter.track(events.upCancelled);
            vscode.commands.executeCommand('okteto.down');
        });

        return new Promise(resolve => {
            const seen = new Map<string, boolean>();
            const messages = okteto.getStateMessages();

            progress.report({  message: "Launching your development environment..." });
            const intervalID = setInterval(()=>{
                const state = okteto.getState(namespace, name);
                if (!seen.has(state)) {
                    progress.report({ message: messages.get(state) });
                    console.log(`okteto is ${state}`);
                }

                seen.set(state, true);

                if (okteto.state.ready === state) {
                    clearInterval(intervalID);
                    ssh.isReady(port)
                    .then(() =>{
                        console.log(`SSH server is ready`);
                        openSSHHostSelector(namespace, name);
                        resolve();
                    }, (err) => {
                        reporter.track(events.sshServiceFailed);
                        console.error(`SSH wasn't available after 60 seconds: ${err.Message}`);
                        onOktetoFailed(`Okteto: Up command failed, SSH server wasn't available after 60 seconds`);
                        resolve();
                    });
                    return;
                } else if (okteto.state.failed === state) {
                    reporter.track(events.oktetoUpFailed);
                    onOktetoFailed(`Okteto: Up command failed to start your development environment`);
                    resolve();
                    clearInterval(intervalID);
                    return;
                }
            }, 1000);
        });
    });
}

function openSSHHostSelector(namespace: string, name: string) {
    reporter.track(events.upReady);
    vscode.commands.executeCommand("opensshremotes.openEmptyWindow", {hostName: name})
    .then((r) =>{
        console.log(`opensshremotes.openEmptyWindow executed`);
        reporter.track(events.upFinished);
        okteto.notifyIfFailed(namespace, name, onOktetoFailed);
                
    }, (reason) => {
        console.error(`opensshremotes.openEmptyWindow failed: ${reason}`);
        reporter.track(events.sshHostSelectionFailed);
        onOktetoFailed(`Okteto: Up command failed to open the host selector: ${reason}`);
    });
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
        return { label: vscode.workspace.asRelativePath(file), uri: file };
    });
    const manifestItem = await vscode.window.showQuickPick(items, {
        canPickMany: false,
        placeHolder: 'Select your okteto manifest'
    });
    return manifestItem ? manifestItem.uri : undefined;
}
