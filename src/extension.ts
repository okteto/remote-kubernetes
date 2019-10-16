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
                        openSSHHostSelector(name, port);
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

function openSSHHostSelector(name: string, port: number) {
    reporter.track(events.upReady);
    vscode.commands.executeCommand("opensshremotes.openEmptyWindow", {hostName: name})
    .then((r) =>{
        console.log(`opensshremotes.openEmptyWindow executed`);
        reporter.track(events.upFinished);
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
