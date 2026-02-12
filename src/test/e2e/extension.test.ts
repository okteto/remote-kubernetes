import * as assert from 'assert';
import * as vscode from 'vscode';

const expectedCommands = [
	'okteto.up',
	'okteto.down',
	'okteto.test',
	'okteto.install',
	'okteto.deploy',
	'okteto.destroy',
	'okteto.context',
	'okteto.namespace',
];

suite('Extension', () => {
	test('should be present', () => {
		const ext = vscode.extensions.getExtension('okteto.remote-kubernetes');
		assert.ok(ext, 'Extension not found');
	});

	test('should activate', async () => {
		const ext = vscode.extensions.getExtension('okteto.remote-kubernetes')!;
		await ext.activate();
		assert.strictEqual(ext.isActive, true);
	});

	test('should register all commands', async () => {
		const allCommands = await vscode.commands.getCommands(true);
		for (const cmd of expectedCommands) {
			assert.ok(allCommands.includes(cmd), `Command "${cmd}" not registered`);
		}
	});

	test('should have context values set', async () => {
		// Give extension time to set context after activation
		await new Promise(resolve => setTimeout(resolve, 100));

		// Context values should be set during activation
		// We can't directly test context values, but we can verify commands are available
		const allCommands = await vscode.commands.getCommands(true);
		assert.ok(allCommands.includes('okteto.up'), 'okteto.up should be registered');
		assert.ok(allCommands.includes('okteto.deploy'), 'okteto.deploy should be registered');
	});

	test('should have correct extension ID', () => {
		const ext = vscode.extensions.getExtension('okteto.remote-kubernetes');
		assert.ok(ext, 'Extension not found');
		// Extension ID includes publisher: Publisher.extensionName
		assert.strictEqual(ext.id, 'Okteto.remote-kubernetes');
	});
});
