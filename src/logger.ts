import * as vscode from 'vscode';

let outputChannel: vscode.LogOutputChannel | undefined;

/**
 * Initializes the Okteto LogOutputChannel for structured logging.
 * Creates a new channel or returns the existing one if already initialized.
 * The channel is automatically registered for disposal with the extension context.
 * @returns The initialized LogOutputChannel instance
 */
export function initializeLogger(): vscode.LogOutputChannel {
	if (!outputChannel) {
		outputChannel = vscode.window.createOutputChannel('Okteto', { log: true });
	}
	return outputChannel;
}

/**
 * Gets the Okteto LogOutputChannel instance.
 * Auto-initializes if not already done (useful for tests and standalone module usage).
 * @returns The LogOutputChannel instance for logging Okteto operations
 */
export function getLogger(): vscode.LogOutputChannel {
	if (!outputChannel) {
		// Auto-initialize if not already done (useful for tests and standalone module usage)
		return initializeLogger();
	}
	return outputChannel;
}
