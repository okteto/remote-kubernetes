import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { runTests, downloadAndUnzipVSCode } from '@vscode/test-electron';
import { execSync } from 'child_process';

async function main() {
    try {
        console.log('[SMOKE TEST RUNNER] Starting smoke test execution...');

        // Get environment variables
        const testWorkspace = process.env.SMOKE_TEST_WORKSPACE;
        const vsixPath = process.env.SMOKE_TEST_VSIX;

        if (!testWorkspace) {
            throw new Error('SMOKE_TEST_WORKSPACE environment variable not set');
        }

        if (!vsixPath) {
            throw new Error('SMOKE_TEST_VSIX environment variable not set');
        }

        console.log('[SMOKE TEST RUNNER] Configuration:');
        console.log(`  Workspace: ${testWorkspace}`);
        console.log(`  VSIX: ${vsixPath}`);

        // The folder containing the Extension Manifest package.json
        const extensionDevelopmentPath = path.resolve(__dirname, '../../../');

        // The path to the extension test runner script
        const extensionTestsPath = path.resolve(__dirname, './index');

        console.log('[SMOKE TEST RUNNER] Downloading VS Code...');
        const vscodeExecutablePath = await downloadAndUnzipVSCode('stable');

        console.log(`[SMOKE TEST RUNNER] Installing extension from VSIX: ${vsixPath}`);
        // Install the extension from .vsix
        try {
            execSync(
                `"${vscodeExecutablePath}" --install-extension "${vsixPath}" --force`,
                { stdio: 'inherit' }
            );
            console.log('[SMOKE TEST RUNNER] Extension installed successfully');
        } catch (error) {
            console.error('[SMOKE TEST RUNNER] Failed to install extension:', error);
            throw error;
        }

        // Create temporary user data directory with custom settings
        const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-smoke-test-'));
        const settingsDir = path.join(userDataDir, 'User');
        fs.mkdirSync(settingsDir, { recursive: true });

        // Disable Remote-SSH mode for smoke test
        const settings = {
            'okteto.remoteSSH': false
        };
        fs.writeFileSync(
            path.join(settingsDir, 'settings.json'),
            JSON.stringify(settings, null, 2)
        );
        console.log('[SMOKE TEST RUNNER] Configured VS Code with okteto.remoteSSH: false');

        console.log('[SMOKE TEST RUNNER] Launching VS Code for testing...');
        console.log('');

        // Run the smoke tests
        await runTests({
            vscodeExecutablePath,
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [
                testWorkspace,
                '--disable-extensions', // Disable other extensions for clean test
                '--disable-workspace-trust', // Disable workspace trust prompt
                `--user-data-dir=${userDataDir}`, // Use custom settings
            ],
        });

        console.log('');
        console.log('[SMOKE TEST RUNNER] Tests completed successfully');

        // Cleanup temporary directory
        fs.rmSync(userDataDir, { recursive: true, force: true });

    } catch (err) {
        console.error('');
        console.error('[SMOKE TEST RUNNER] Failed to run smoke tests');
        console.error(err);
        process.exit(1);
    }
}

main();
