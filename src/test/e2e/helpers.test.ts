import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Helper Functions', () => {
	test('should get extension version', async () => {
		const ext = vscode.extensions.getExtension('okteto.remote-kubernetes');
		assert.ok(ext, 'Extension not found');

		const version = ext.packageJSON.version;
		assert.ok(version, 'Version should be defined');
		assert.match(version, /^\d+\.\d+\.\d+$/, 'Version should match semver format');
	});

	test('should have correct publisher', () => {
		const ext = vscode.extensions.getExtension('okteto.remote-kubernetes');
		assert.ok(ext, 'Extension not found');
		assert.strictEqual(ext.packageJSON.publisher, 'Okteto');
	});

	test('should have displayName', () => {
		const ext = vscode.extensions.getExtension('okteto.remote-kubernetes');
		assert.ok(ext, 'Extension not found');
		assert.strictEqual(ext.packageJSON.displayName, 'Remote - Kubernetes');
	});

	test('should have correct main entry point', () => {
		const ext = vscode.extensions.getExtension('okteto.remote-kubernetes');
		assert.ok(ext, 'Extension not found');
		assert.strictEqual(ext.packageJSON.main, './dist/extension');
	});

	test('should have all configuration properties', () => {
		const ext = vscode.extensions.getExtension('okteto.remote-kubernetes');
		assert.ok(ext, 'Extension not found');

		const config = ext.packageJSON.contributes.configuration.properties;
		assert.ok(config['okteto.remoteSSH'], 'remoteSSH config missing');
		assert.ok(config['okteto.binary'], 'binary config missing');
		assert.ok(config['okteto.telemetry'], 'telemetry config missing');
		assert.ok(config['okteto.gitBash'], 'gitBash config missing');
		assert.ok(config['okteto.upArgs'], 'upArgs config missing');
		assert.ok(config['okteto.upTimeout'], 'upTimeout config missing');
	});

	test('should read okteto configuration', () => {
		const config = vscode.workspace.getConfiguration('okteto');
		assert.ok(config, 'Configuration should be available');

		// Test default values
		const remoteSSH = config.get<boolean>('remoteSSH');
		const telemetry = config.get<boolean>('telemetry');

		// These should have defaults even if not set by user
		assert.strictEqual(typeof remoteSSH, 'boolean', 'remoteSSH should be boolean');
		assert.strictEqual(typeof telemetry, 'boolean', 'telemetry should be boolean');
	});
});
