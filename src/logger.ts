import * as vscode from 'vscode';

let outputChannel: vscode.LogOutputChannel | undefined;

export function initializeLogger(): vscode.LogOutputChannel {
	if (!outputChannel) {
		outputChannel = vscode.window.createOutputChannel('Okteto', { log: true });
	}
	return outputChannel;
}

export function getLogger(): vscode.LogOutputChannel {
	if (!outputChannel) {
		// Auto-initialize if not already done (useful for tests and standalone module usage)
		return initializeLogger();
	}
	return outputChannel;
}
