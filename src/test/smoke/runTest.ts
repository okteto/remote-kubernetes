import * as path from 'path';
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
            ],
        });

        console.log('');
        console.log('[SMOKE TEST RUNNER] Tests completed successfully');

    } catch (err) {
        console.error('');
        console.error('[SMOKE TEST RUNNER] Failed to run smoke tests');
        console.error(err);
        process.exit(1);
    }
}

main();
