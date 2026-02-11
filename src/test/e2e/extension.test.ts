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
});
