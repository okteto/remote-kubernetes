import * as vscode from 'vscode';
import * as manifest from './manifest';
import * as ssh from './ssh';
import * as okteto from './okteto';
import * as kubernetes from './kubernetes';
import * as analytics from './analytics';

export var activeManifest: string;

export function activate(context: vscode.ExtensionContext) {
    console.log('okteto extension activated');
    analytics.track('activated');
    context.subscriptions.push(vscode.commands.registerCommand('okteto.up', upCommand));	
    context.subscriptions.push(vscode.commands.registerCommand('okteto.down', downCommand));
    context.subscriptions.push(vscode.commands.registerCommand('okteto.install', installCmd));
    
}

function installCmd(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        vscode.window.withProgress({
        location: vscode.ProgressLocation.Window,
        title: "Installing Okteto",
    }, (progress, token)=>{
        analytics.track('installcmd');
        const p = install();
        p.then(()=>{ 
            vscode.window.showInformationMessage(`Okteto was successfully installed`);
            resolve();
        }, (reason) => {
            analytics.track('failedinstallcmd');
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
    analytics.track('downcmd');
    if (!okteto.isInstalled()){
        installCmd()
        .then(() => {
            getManifestOrAsk().then((manifestPath)=> {
                if (manifestPath) {
                    down(manifestPath);
                } else {
                    analytics.track("failpickmanifest");
                }
            });
        }, (reason) => {
            analytics.track('downcmdinstallfailed');
            vscode.window.showErrorMessage(`Okteto: Install command failed: ${reason.message}`);
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
                } else {
                    analytics.track("failpickmanifest");
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
                analytics.track("oktetodownfailed");
                vscode.window.showErrorMessage(`Command failed: ${e.stderr}`);
            }

            ssh.removeConfig(name).then(()=> {
                activeManifest = '';
                vscode.window.showInformationMessage("Okteto environment deactivated");
                console.log(`okteto environment deactivated`);
            }, (reason)=> {
                console.error(`failed to delete ssh configuration: ${reason}`);
            });
        });
    }, (reason) => {
        vscode.window.showErrorMessage(`Command failed: ${reason.message}`);
    });
}

function upCommand() {
    analytics.track('upcmd');
    if (!okteto.isInstalled()){
        installCmd().then(() => {
            up();
        }, (reason) => {
            vscode.window.showErrorMessage(`Okteto: Install command failed: ${reason.message}`);            
        });
    } else {
        up();
    } 
}

function up() {
    showManifestPicker('Load')
    .then((value) => {
        if (!value) {
            analytics.track('notpickedmanifestup');
            return;
        }

        const manifestPath = value[0].fsPath;
        console.log(`user selected: ${manifestPath}`);
        manifest.getName(manifestPath).then((name) =>{
            const ktx = kubernetes.getCurrentContext();
            if (!ktx) {
                vscode.window.showErrorMessage("Couldn't detect your current Kubernetes context.");
                return;
            } 

            ssh.getPort().then((port) => {
                okteto.start(manifestPath, ktx.namespace, name, port).then(()=>{
                    okteto.notifyIfFailed(ktx.namespace, name, onOktetoFailed);
                    activeManifest = manifestPath;
                    waitForUp(ktx.namespace, name, port);
                }, (reason) => {
                    analytics.track('sshoktetoupfailed');
                    console.error(`okteto.start failed: ${reason.message}`);
                    onOktetoFailed();    
                });
            }, (reason) => {
                analytics.track('sshgetportfailed');
                console.error(`ssh.getPort failed: ${reason.message}`);
                onOktetoFailed();
            });

        }, (reason) =>{
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
                        analytics.track('sshnotready');
                        console.error(`SSH wasn't available after 60 seconds: ${err.Message}`);
                        onOktetoFailed();
                        resolve();
                    });
                    return;
                } else if (okteto.state.failed === state) {
                    analytics.track('oktetoupfailed');
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
    ssh.updateConfig(name, port).then(()=> {
        vscode.window.onDidCloseTerminal((t) => {
            if (t.name === okteto.terminalName) {
                ssh.removeConfig(name);
            }
        });

        startRemote(name);
    });    

    // opensshremotesexplorer.emptyWindowInNewWindow
    // opensshremotes.openEmptyWindow -> opens the host-selection dialog	
}

function startRemote(name: string) {
    vscode.commands.executeCommand("opensshremotes.openEmptyWindow", {hostName: name})
    .then((r) =>{
        console.log(`opensshremotes.openEmptyWindow executed`);	
        analytics.track('remoteselected');
    }, (reason) => {
        console.error(`opensshremotes.openEmptyWindow failed: ${reason}`);	
        analytics.track('remotenotselected');
        onOktetoFailed();
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
