'use strict';

import * as vscode from 'vscode';
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
        p.then(()=>{ 
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

function downCommand() {
    reporter.track(events.down);
    const r = okteto.needsInstall();
    if (r.install){
        installCmd(r.upgrade)
        .then(() => {
            getManifestOrAsk().then((manifestPath)=> {
                if (manifestPath) {
                    down(manifestPath);
                }
            });
        });
    } else {
        getManifestOrAsk().then((manifestPath)=> {
            if (manifestPath) {
                down(manifestPath);
            }
        });
    }
}

function getManifestOrAsk(): Promise<string> {
    return new Promise<string>((resolve, reject) =>{
        if (activeManifest) {
            resolve(activeManifest);
        } else {
            showManifestPicker('Load').then((value) => {
                if (value) { 
                    resolve(value[0].fsPath);
                    reporter.track(events.manifestSelected);
                } else {
                    reporter.track(events.manifestDismissed);
                }
            });
        }
    });
}

function down(manifestPath: string) {
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

            ssh.removeConfig(name).then(()=> {
                activeManifest = '';
                vscode.window.showInformationMessage("Okteto environment deactivated");
                console.log(`okteto environment deactivated`);
                reporter.track(events.downFinished);
            }, (reason)=> {
                reporter.track(events.sshRemoveFailed);
                console.error(`failed to delete ssh configuration: ${reason}`);
            });
        });
    }, (reason) => {
        reporter.track(events.manifestLoadFailed);
        vscode.window.showErrorMessage(`Command failed: ${reason.message}`);
    });
}

function upCommand() {
    reporter.track(events.up);
    const r = okteto.needsInstall();
    if (r.install){
        installCmd(r.upgrade)
        .then(() => {
            up();
        });
    } else {
        up();
    } 
}

function up() {
    showManifestPicker('Load')
    .then((value) => {
        if (!value) {
            reporter.track(events.manifestDismissed);
            return;
        }

        reporter.track(events.manifestSelected);
        const manifestPath = value[0].fsPath;
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
                    okteto.notifyIfFailed(ktx.namespace, name, onOktetoFailed);
                    activeManifest = manifestPath;
                    waitForUp(ktx.namespace, name, port);
                }, (reason) => {
                    reporter.track(events.oktetoUpStartFailed);
                    console.error(`okteto.start failed: ${reason.message}`);
                    onOktetoFailed();    
                });
            }, (reason) => {
                reporter.track(events.sshPortFailed);
                console.error(`ssh.getPort failed: ${reason.message}`);
                onOktetoFailed();
            });

        }, (reason) =>{
            reporter.track(events.manifestLoadFailed);
            console.error(`failed to load the manifest: ${reason.message}`);
            onOktetoFailed();
        });
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

            progress.report({  message: "Launching your Okteto Environment..." });
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
                        onOktetoReady(name, port);
                        resolve();
                    }, (err) => {
                        reporter.track(events.sshServiceFailed);
                        console.error(`SSH wasn't available after 60 seconds: ${err.Message}`);
                        onOktetoFailed();
                        resolve();
                    });
                    return;
                } else if (okteto.state.failed === state) {
                    reporter.track(events.oktetoUpFailed);
                    onOktetoFailed();
                    resolve();
                    clearInterval(intervalID);
                    return;
                }
            }, 1000);
        });				
    });
}

function onOktetoReady(name: string, port: number) {
    reporter.track(events.upReady);
    ssh.updateConfig(name, port)
    .then(()=> {
        vscode.window.onDidCloseTerminal((t) => {
            if (t.name === okteto.terminalName) {
                ssh.removeConfig(name);
            }
        });

        // opensshremotesexplorer.emptyWindowInNewWindow
        // opensshremotes.openEmptyWindow -> opens the host-selection dialog	
        vscode.commands.executeCommand("opensshremotes.openEmptyWindow", {hostName: name})
        .then((r) =>{
            console.log(`opensshremotes.openEmptyWindow executed`);
            reporter.track(events.upFinished);
        }, (reason) => {
            console.error(`opensshremotes.openEmptyWindow failed: ${reason}`);	
            reporter.track(events.sshHostSelectionFailed);
            onOktetoFailed();
        });
    }, (err) =>{
        reporter.track(events.sshConfigFailed);
        console.error(`ssh.updateConfig failed: ${err.Message}`);
        vscode.window.showErrorMessage(`Command failed: ${err.Message}`);
    }); 
}

function onOktetoFailed() {
    vscode.window.showErrorMessage(`Okteto: Up command failed to start your development environment`);
    okteto.showTerminal();
}

function showManifestPicker(label: string) : Thenable<vscode.Uri[] | undefined> {
    return vscode.window.showOpenDialog({
        defaultUri: manifest.getDefaultLocation(),
        openLabel: label,
        canSelectMany: false,
        canSelectFiles: true,
        canSelectFolders: false,
        filters: {
            'Okteto Manifest': ['yml', 'yaml']
        }
    });
}
