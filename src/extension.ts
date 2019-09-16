import * as vscode from 'vscode';
import * as manifest from './manifest'
import * as ssh from './ssh'
import * as okteto from './okteto'
import * as kubernetes from './kubernetes';

export function activate(context: vscode.ExtensionContext) {
	console.log('okteto extension activated');
	context.subscriptions.push(vscode.commands.registerCommand('okteto.startUp', startUpCommand));
	context.subscriptions.push(vscode.commands.registerCommand('okteto.up', upCommand));	
	context.subscriptions.push(vscode.commands.registerCommand('okteto.down', downCommand));
}

function downCommand() {
	console.log('okteto.down');
	
	if (!okteto.isInstalled()){
		vscode.window.showErrorMessage('You need to install okteto in order to use this extension. Go to https://github.com/okteto/okteto for more information.');
	}
	
	if (vscode.workspace.workspaceFolders == undefined) {
		vscode.window.showErrorMessage("A folder needs to be open for the extension to work.");
		return;
	}
	
	const manifestPath = manifest.getPath(vscode.workspace.workspaceFolders[0].uri.fsPath);
	if (!manifest.exists(manifestPath)) {
		vscode.window.showErrorMessage("Couldn't find your `okteto.yml` manifest. Please run the `Okteto: Init` command first.");
		return;
	}

	const namespace = kubernetes.getCurrentNamespace(); 
	const name = manifest.getName(manifestPath);
	okteto.down(manifestPath, namespace, name).then((e) => {
		vscode.window.showInformationMessage("Okteto environment deactivated");
	}, (reason) => {
		console.log(`okteto down exited with an error: ${reason}`);
	});
}

function upCommand() {
	console.log('okteto.up');
	if (!okteto.isInstalled()){
		vscode.window.showErrorMessage('You need to install okteto in order to use this extension. Go to https://github.com/okteto/okteto for more information.');
	}
	
	if (vscode.workspace.workspaceFolders == undefined) {
		vscode.window.showErrorMessage("A folder needs to be open for the extension to work.");
		return;
	}
	
	const manifestPath = manifest.getPath(vscode.workspace.workspaceFolders[0].uri.fsPath);
	if (!manifest.exists(manifestPath)) {
		vscode.window.showErrorMessage("Couldn't find your `okteto.yml` manifest. Please run the `Okteto: Init` command first.");
		return;
	}

	const name = manifest.getName(manifestPath);
	const namespace = kubernetes.getCurrentNamespace(); 
	if (!namespace) {
		vscode.window.showErrorMessage("Couldn't detect your current Kubernetes context.");
		return;
	}
	
	okteto.start(manifestPath, namespace, name)
	.then(()=>{
		okteto.monitorFailed(namespace, name, onOktetoFailed);
		vscode.commands.executeCommand("okteto.startUp", namespace, name, manifestPath);
	})
	.catch((reason)=>{
		console.log(reason);
		onOktetoFailed();
	});

	
}

function startUpCommand(namespace: string, name: string, manifestPath: string) {
	console.log('okteto.startUp');
	vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: "Starting your development environment",
		cancellable: true
	}, (progress, token) => {
		token.onCancellationRequested(() => {
			vscode.commands.executeCommand('okteto.down');
		});

		return new Promise(resolve => {
			var seen = new Map<string, boolean>();
			progress.report({ increment: 0, message: "Launching your Okteto Environment..." });
			const intervalID = setInterval(()=>{
			
				const state = okteto.getState(namespace, name);
				console.log(`okteto is ${state}`);
				switch(state) {
					case okteto.state.provisioning:
						console.log('up is starting');
					case okteto.state.provisioning:
						if (!seen.has(state)) {
							progress.report({ increment: 20, message: "Provisioning your persistent volume..." });
						}
						
						break;
					case okteto.state.startingSync:						
					if (!seen.has(state)) {
							progress.report({ increment: 20, message: "Starting the file synchronization service..."});
						}
						break;
					case okteto.state.synchronizing:
						if (!seen.has(state)) {
							progress.report({ increment: 20, message: "Synchronizing your files..."});
						}
						break;
					case okteto.state.activating:
						if (!seen.has(state)) {	
							progress.report({ increment: 20, message: "Activating your Okteto Environment..."});
						}
						break;
					case okteto.state.ready:
						progress.report({ increment: 20, message: "Your Okteto Environment is ready..."});				
						onOktetoReady(name);
						resolve();
						clearInterval(intervalID);
						return;
					case okteto.state.failed:
						onOktetoFailed();
						resolve();
						clearInterval(intervalID);
						return;
				}

				seen.set(state, true);
			}, 1000);
		});				
	})
}

function onOktetoReady(name: string) {
	// generate SSH configuration
	ssh.updateConfig(name, 22000);
	// launch remote extension
	vscode.commands.executeCommand("opensshremotes.openEmptyWindow", {hostName: name}).then((r) =>{
		console.log(r);	
	}, (f) => {
		console.error(f);	
	});

	// opensshremotesexplorer.emptyWindowInNewWindow
	// opensshremotes.openEmptyWindow -> opens the host-selection dialog	
}

function onOktetoFailed() {
	vscode.window.showErrorMessage(`Okteto: Start command failed to start your development environment`);
}