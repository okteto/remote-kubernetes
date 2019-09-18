import * as vscode from 'vscode';
import * as manifest from './manifest'
import * as ssh from './ssh'
import * as okteto from './okteto'
import * as kubernetes from './kubernetes';

export function activate(context: vscode.ExtensionContext) {
    console.log('okteto extension activated');
    const upFn = () => {upCommand(context.workspaceState)}
    const downFn = () => {downCommand(context.workspaceState)}

    context.subscriptions.push(vscode.commands.registerCommand('okteto.up', upFn));	
    context.subscriptions.push(vscode.commands.registerCommand('okteto.down', downFn));
    context.subscriptions.push(vscode.commands.registerCommand('okteto.install', installCmd));
    
}

function installCmd() {
    console.log('okteto.install');
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Window,
        title: "Installing Okteto",
    }, (progress, token)=>{
        return new Promise((resolve, reject) => {
            okteto.install()
            .then(()=>{
                console.log("okteto was successfully installed");
                resolve();
                vscode.window.showInformationMessage(`Okteto was successfully installed`);
            }, (reason) => {
                console.error(`okteto was not installed: ${reason}`);
                throw new Error(reason);
            }).catch((reason) => {
                console.error(`okteto was not installed: ${reason}`);
                reject();
                vscode.window.showErrorMessage(`Okteto was not installed: ${reason.message}`);
            });
        });
    });
}

function downCommand(state: vscode.Memento) {
    if (!okteto.isInstalled()){
        const yes = 'yes';
        const no = 'no';
        vscode.window.showInformationMessage('Okteto is not installed. Would you like it to install it now?', yes, no)
          .then((choice)=>{
              if (!choice || choice == no) {
                  return
              }

              okteto.install().then(() => {
                getManifestOrAsk(state).then((manifestPath)=> {
                    if (manifestPath) {
                        down(manifestPath, state);
                    }
                }, (reason) => {
                vscode.window.showErrorMessage(`Okteto: Install command failed: ${reason.message}`);
              })
          })
        });
    } else {
        getManifestOrAsk(state).then((manifestPath)=> {
            if (manifestPath) {
                down(manifestPath, state);
            }
        });
    }
}

function getManifestOrAsk(state: vscode.Memento): Promise<string> {
    return new Promise<string>((resolve, reject) =>{
        const manifestPath = state.get<string>('activeManifest');
        if (manifestPath) {
            resolve(manifestPath);
        } else {
            showManifestPicker('Load').then((value) => {
                if (value) { 
                    resolve(value[0].fsPath);
                }
            });
        }
    });
}

function down(manifestPath: string, state: vscode.Memento) {
    const ktx = kubernetes.getCurrentContext(); 
    if (!ktx.namespace) {
        vscode.window.showErrorMessage("Couldn't detect your current Kubernetes context.");
        return;
    }

    manifest.getName(manifestPath).then((name) => {
        okteto.down(manifestPath, ktx.namespace, name).then((e) =>{
            if (e.failed) {
                vscode.window.showErrorMessage(`Command failed: ${e.stderr}`);
            }

            ssh.removeConfig(name).then(()=> {
                state.update('activeManifest', '');
                vscode.window.showInformationMessage("Okteto environment deactivated");
                console.log(`okteto environment deactivated`);
            }, (reason)=> {
                console.error(`failed to delete ssh configuration: ${reason}`);
            });
        })
    }, (reason) => {
        vscode.window.showErrorMessage(`Command failed: ${reason.message}`);
    });
}

function upCommand(state: vscode.Memento) {
    if (!okteto.isInstalled()){
        const yes = 'yes';
        const no = 'no';
        vscode.window.showInformationMessage('Okteto is not installed. Would you like it to install it now?', yes, no)
          .then((choice)=>{
              if (!choice || choice == no) {
                  return
              }

              okteto.install().then(() => {
                  up(state);
              }, (reason) => {
                vscode.window.showErrorMessage(`Okteto: Install command failed: ${reason.message}`);
              })
          })
    } else {
        up(state);
    } 
}

function up(state: vscode.Memento) {
    showManifestPicker('Load').then((value) => {
        if (!value) {
            return;
        }

        const manifestPath = value[0].fsPath;
        console.log(`user selected: ${manifestPath}`);
        manifest.getName(manifestPath).then((name) =>{
            const ktx = kubernetes.getCurrentContext();
            if (!ktx.namespace) {
                vscode.window.showErrorMessage("Couldn't detect your current Kubernetes context.");
                return;
            } 

            ssh.getPort().then((port) => {
                okteto.start(manifestPath, ktx.namespace, name, port).then(()=>{
                    console.log('okteto started');
                    okteto.notifyIfFailed(ktx.namespace, name, onOktetoFailed);
                    state.update('activeManifest', manifestPath);
                    waitForUp(ktx.namespace, name, port);
                }, (reason) => {
                    console.error(`okteto.start failed: ${reason.message}`);
                    onOktetoFailed();    
                })
            }, (reason) => {
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

                if (okteto.state.ready == state) {
                    onOktetoReady(name, port);
                    resolve();
                    clearInterval(intervalID);
                    return;
                } else if (okteto.state.failed == state) {
                    onOktetoFailed();
                    resolve();
                    clearInterval(intervalID);
                    return;
                }
            }, 1000);
        });				
    })
}

function onOktetoReady(name: string, port: number) {
    ssh.updateConfig(name, port).then(()=> {
        vscode.commands.executeCommand("opensshremotes.openEmptyWindow", {hostName: name})
        .then((r) =>{
          console.log(`opensshremotes.openEmptyWindow executed`);	
        }, (reason) => {
          console.error(`opensshremotes.openEmptyWindow failed: ${reason}`);	
          onOktetoFailed();
        });
    });    

    // opensshremotesexplorer.emptyWindowInNewWindow
    // opensshremotes.openEmptyWindow -> opens the host-selection dialog	
}

function onOktetoFailed() {
    vscode.window.showErrorMessage(`Okteto: Up command failed to start your development environment`);
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
    })
}

