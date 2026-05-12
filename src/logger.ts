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

/**
 * Disposes the module-level LogOutputChannel and clears the cached reference.
 *
 * Pairs with `getLogger()`'s auto-init fallback: if a module calls `getLogger()`
 * before the extension's `activate()` ever pushed the channel onto
 * `context.subscriptions`, the auto-created channel would otherwise stay
 * referenced by this module past `deactivate()`. Calling `disposeLogger()` from
 * `deactivate()` (and again from tests that tear down) guarantees the next
 * `activate()` builds a fresh channel.
 *
 * Safe to call multiple times — `LogOutputChannel.dispose()` is idempotent.
 */
export function disposeLogger(): void {
	outputChannel?.dispose();
	outputChannel = undefined;
}

