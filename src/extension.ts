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
    console.log('okteto.down');
    if (!okteto.isInstalled()){
        vscode.window.showErrorMessage('You need to install okteto in order to use this extension. Go to https://github.com/okteto/okteto for more information.');
    }

    const manifestPath = state.get<string>('activeManifest');
    if (!manifestPath){
        showManifestPicker('Load')
        .then((value) => {
            if (value) { 
                down(value[0].fsPath, state);
            }
        });
    } else {
        down(manifestPath, state);
    }
}

function down(manifestPath :string, state: vscode.Memento) {
    const ktx = kubernetes.getCurrentContext(); 
    if (!ktx.namespace) {
        vscode.window.showErrorMessage("Couldn't detect your current Kubernetes context.");
        return;
    }

    const name = manifest.getName(manifestPath);
    okteto.down(manifestPath, ktx.namespace, name)
    .then((e) => {
        if (e.failed) {
            throw new Error(e.stderr);
        }

        ssh.removeConfig(name).then(()=> {
            state.update('activeManifest', '');
            vscode.window.showInformationMessage("Okteto environment deactivated");
            console.log(`okteto environment deactivated`);
        }, (reason) => {
            console.error(`failed to delete ssh configuration: ${reason}`);
        })
    }, (reason) => {
        throw new Error(reason.message);
    })
    .catch((reason) => {
        vscode.window.showErrorMessage(`Command failed: ${reason.message}`);
    });
}
function upCommand(state: vscode.Memento) {
    console.log('okteto.up');
    
    if (!okteto.isInstalled()){
        vscode.window.showInformationMessage('Okteto is not installed. Would you like it to install it now?', 'yes', 'no');
        return
    }
    
    showManifestPicker('Load').then((value) => {
        if (!value) {
            return;
        }

        const manifestPath = value[0].fsPath;
        console.log(`user selected: ${manifestPath}`);
        const name = manifest.getName(manifestPath);
        const ktx = kubernetes.getCurrentContext(); 
        state.update('activeManifest', manifestPath);

        if (!ktx.namespace) {
            vscode.window.showErrorMessage("Couldn't detect your current Kubernetes context.");
            return;
        }
    
        ssh.getPort().then((port) => {
            okteto.start(manifestPath, ktx.namespace, name, port)
            .then(()=>{
                console.log('okteto started');
                waitForUp(ktx.namespace, name, port)
                okteto.notifyIfFailed(ktx.namespace, name, onOktetoFailed);
            }, (reason) =>{ throw new Error(reason.message);})
            .catch((reason)=>{
                console.error(`okteto.start failed: ${reason}`);
                onOktetoFailed();
            });
        }, (reason) => {throw new Error(reason.message);})
        .catch((reason)=>{
            console.error(`okteto.up failed: ${reason.message}`);
            onOktetoFailed();
        });
    })
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
                } else if (okteto.state.failed == state) {
                    onOktetoFailed();
                    resolve();
                    clearInterval(intervalID);
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

