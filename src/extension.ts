import * as vscode from 'vscode';
import * as manifest from './manifest'
import * as ssh from './ssh'
import * as okteto from './okteto'
import * as kubernetes from './kubernetes';

export function activate(context: vscode.ExtensionContext) {
	console.log('okteto extension activated');
	context.subscriptions.push(vscode.commands.registerCommand('okteto.up', upCommand));	
	context.subscriptions.push(vscode.commands.registerCommand('okteto.down', downCommand));
}

function downCommand(state: vscode.Memento) {
	console.log('okteto.down');
	if (!okteto.isInstalled()){
		vscode.window.showErrorMessage('You need to install okteto in order to use this extension. Go to https://github.com/okteto/okteto for more information.');
	}

	function runDown(manifestPath :string) {
		const ktx = kubernetes.getCurrentContext(); 
		if (!ktx.namespace) {
			vscode.window.showErrorMessage("Couldn't detect your current Kubernetes context.");
			return;
		}

		const name = manifest.getName(manifestPath);
		okteto.down(manifestPath, ktx.namespace, name).then((e) => {
			vscode.window.showInformationMessage("Okteto environment deactivated");
		}, (reason) => {
			console.error(`okteto down exited with an error: ${reason}`);
		});
	}

	selectManifest().then((value) => {
		if (!value) {
			return;
		}

		runDown(value[0].fsPath);
	}, (reason) => {
		console.log(`user canceled down: ${reason}`);
	});
}

function upCommand() {
	console.log('okteto.up');
	if (!okteto.isInstalled()){
		vscode.window.showErrorMessage('You need to install okteto in order to use this extension. Go to https://github.com/okteto/okteto for more information.');
	}
	
	selectManifest().then((value) => {
		if (!value) {
			return;
		}

		const manifestPath = value[0].fsPath;
		console.log(`user selected: ${manifestPath}`);
		const name = manifest.getName(manifestPath);
		const ktx = kubernetes.getCurrentContext(); 
		if (!ktx.namespace) {
			vscode.window.showErrorMessage("Couldn't detect your current Kubernetes context.");
			return;
		}
	
		okteto.start(manifestPath, ktx.namespace, name)
		.then(()=>{
			console.log('okteto started');
			waitForUp(ktx.namespace, name)
			okteto.notifyIfFailed(ktx.namespace, name, onOktetoFailed);
		}, (reason) =>{
			throw reason;
		})
		.catch((reason)=>{
			console.log(reason);
			onOktetoFailed();
		});
	}, (reason) => {
		console.log(`user canceled: ${reason}`);
		}
	)
}

function waitForUp(namespace: string, name: string) {
	console.log('okteto.startUp');
	vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,		
		cancellable: true
	}, (progress, token) => {
		token.onCancellationRequested(() => {
			vscode.commands.executeCommand('okteto.down');
		});

		return new Promise(resolve => {
			var seen = new Map<string, boolean>();
			progress.report({  message: "Launching your Okteto Environment..." });
			const intervalID = setInterval(()=>{
			
				const state = okteto.getState(namespace, name);
				console.log(`okteto is ${state}`);
				switch(state) {
					case okteto.state.provisioning:
						console.log('up is starting');
					case okteto.state.provisioning:
						if (!seen.has(state)) {
							progress.report({ message: "Provisioning your persistent volume..." });
						}
						break;
					case okteto.state.startingSync:						
					if (!seen.has(state)) {
							progress.report({ message: "Starting the file synchronization service..."});
						}
						break;
					case okteto.state.synchronizing:
						if (!seen.has(state)) {
							progress.report({ message: "Synchronizing your files..."});
						}
						break;
					case okteto.state.activating:
						if (!seen.has(state)) {	
							progress.report({ message: "Activating your Okteto Environment..."});
						}
						break;
					case okteto.state.ready:
						progress.report({ message: "Your Okteto Environment is ready..."});				
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
		console.log(`opensshremotes.openEmptyWindow executed`);	
	}, (f) => {
		console.error(`opensshremotes.openEmptyWindow failed: ${f}`);	
		onOktetoFailed();
	});

	// opensshremotesexplorer.emptyWindowInNewWindow
	// opensshremotes.openEmptyWindow -> opens the host-selection dialog	
}

function onOktetoFailed() {
	vscode.window.showErrorMessage(`Okteto: Up command failed to start your development environment`);
}

function selectManifest() : Thenable<vscode.Uri[] | undefined> {
	return vscode.window.showOpenDialog({
		defaultUri: manifest.getDefaultLocation(),
		openLabel: 'Active',
		canSelectMany: false,
		canSelectFiles: true,
		canSelectFolders: false,
		filters: {
			'Okteto Manifest': ['yml', 'yaml']
		}
	})


}

