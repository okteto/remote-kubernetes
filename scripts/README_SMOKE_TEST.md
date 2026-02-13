# Automated Smoke Test

Automated end-to-end smoke test for the Remote - Kubernetes VS Code extension.

## Overview

The smoke test validates the core extension functionality by:
1. Creating a temporary Okteto namespace
2. Cloning the okteto/movies test repository
3. Building the extension from source
4. Running automated tests in VS Code
5. Testing the complete Okteto workflow (up → ready → down)
6. Cleaning up resources

## Prerequisites

- **macOS** (script designed for macOS, uses `screencapture`)
- **Okteto CLI** installed and in PATH
- **Logged into Okteto cluster** (`okteto context` should show active context)
- **Node.js 22.x** and npm
- **Git** installed
- **Internet connection** (to clone test repo and download VS Code)

## Usage

### Quick Start

```bash
# From extension root directory
./scripts/smoke-test.sh
```

### What It Does

1. **Prerequisites Check**
   - Verifies okteto CLI is installed
   - Confirms you're logged into Okteto
   - Checks Node.js, npm, and git are available

2. **Test Setup**
   - Creates namespace: `okteto-smoke-test-{timestamp}`
   - Clones https://github.com/okteto/movies to temp directory
   - Builds .vsix from current code

3. **Smoke Tests**
   - Installs extension from .vsix in fresh VS Code instance
   - Opens movies/catalog workspace
   - Executes `Okteto: Up` command (catalog service)
   - Waits for development environment to be ready
   - Verifies logs appear in Output panel
   - Executes `Okteto: Down` command
   - Verifies cleanup completes
   - Tests context switching

4. **Cleanup**
   - **On success**: Deletes namespace automatically
   - **On failure**: Keeps namespace for debugging
   - Removes temporary files
   - Saves screenshots if tests failed

## Output

### Successful Run
```
==========================================
  Automated Smoke Test
  Remote - Kubernetes Extension
==========================================

[STEP] Checking prerequisites...
[INFO] ✓ Okteto CLI found: okteto version 3.16.0
[INFO] ✓ Logged into Okteto: https://cloud.okteto.com
[INFO] ✓ Node.js found: v22.x.x
[INFO] ✓ npm found: 10.x.x
[INFO] ✓ git found: git version 2.x.x
[INFO] Prerequisites OK

[STEP] Creating test namespace: okteto-smoke-test-1707763200
[INFO] ✓ Namespace created and activated

[STEP] Setting up test repository...
[INFO] ✓ Repository cloned successfully
[INFO] ✓ Catalog service found

[STEP] Building extension...
[INFO] ✓ Extension built: remote-kubernetes-0.5.4.vsix (1.6M)

[STEP] Running smoke tests...
[INFO] Test configuration:
  Workspace: /tmp/xxx/movies/catalog
  Extension: remote-kubernetes-0.5.4.vsix
  Namespace: okteto-smoke-test-1707763200
  Service: catalog

[SMOKE TEST] Verifying extension...
[SMOKE TEST] ✓ Extension is active
[SMOKE TEST] Executing Okteto: Up...
[SMOKE TEST] ✓ Okteto: Up command executed
[SMOKE TEST] Waiting for ready state...
[SMOKE TEST] State: starting
[SMOKE TEST] State: activating
[SMOKE TEST] State: pulling
[SMOKE TEST] State: ready
[SMOKE TEST] ✓ Development environment is ready
[SMOKE TEST] Executing Okteto: Down...
[SMOKE TEST] ✓ Okteto: Down command executed
[SMOKE TEST] ✓ All smoke tests passed in 245.3s

[INFO] ✓ Smoke tests passed!

[STEP] Cleaning up...
[INFO] Deleting namespace: okteto-smoke-test-1707763200 (tests passed)

==========================================
[INFO] ✓ Smoke test completed successfully!
==========================================
```

### Failed Run
```
[ERROR] ✗ Smoke tests failed!

[STEP] Cleaning up...
[WARN] Keeping namespace for debugging: okteto-smoke-test-1707763200
[WARN] To delete manually: okteto namespace delete okteto-smoke-test-1707763200 --force
[INFO] Screenshots saved: 3 files in smoke-test-screenshots/

==========================================
[ERROR] ✗ Smoke test failed - see output above
==========================================
```

## Debugging Failed Tests

### Check Screenshots
Failed tests automatically capture screenshots:
```bash
ls smoke-test-screenshots/
# okteto-up-failed-1707763200.png
# test-failure-1707763200.png
```

### Inspect Test Namespace
If tests fail, the namespace is preserved:
```bash
# List resources in test namespace
okteto namespace use okteto-smoke-test-{timestamp}
kubectl get all

# Check logs
kubectl logs <pod-name>

# Clean up when done
okteto namespace delete okteto-smoke-test-{timestamp} --force
```

### Verbose Output
Check the full test output in the terminal for detailed logs.

## Environment Variables

The script sets these environment variables for the test suite:

- `SMOKE_TEST_WORKSPACE` - Path to movies/catalog directory
- `SMOKE_TEST_VSIX` - Path to built .vsix file
- `SMOKE_TEST_NAMESPACE` - Created test namespace
- `SMOKE_TEST_SERVICE` - Service to test (catalog)
- `SMOKE_TEST_SCREENSHOTS` - Directory for screenshots

## Headless Automation

The smoke tests use **headless automation** to interact with VS Code:

- **Quick Picks**: Automatically selects manifests and services
- **Input Boxes**: Provides predetermined values
- **Commands**: Executes real extension commands
- **Verification**: Checks actual state files and outputs

This tests the **real extension code paths** while avoiding manual interaction.

## Customization

### Test Different Repository
Edit `scripts/smoke-test.sh`:
```bash
MOVIES_REPO="https://github.com/your-org/your-repo"
```

### Test Different Service
Edit `scripts/smoke-test.sh`:
```bash
TEST_SERVICE="your-service"
```

### Adjust Timeouts
Edit `src/test/smoke/smoke.test.ts`:
```typescript
this.timeout(10 * 60 * 1000); // Change timeout
```

## CI Integration

While designed for manual execution, the smoke test can be integrated into CI:

```yaml
# .github/workflows/smoke-test.yml (example)
- name: Login to Okteto
  run: okteto context use ${{ secrets.OKTETO_URL }} --token ${{ secrets.OKTETO_TOKEN }}

- name: Run smoke test
  run: ./scripts/smoke-test.sh
```

Note: Requires Okteto cluster access and secrets configuration.

## Troubleshooting

### "Okteto CLI not found"
```bash
# Install Okteto CLI
brew install okteto
# or
curl https://get.okteto.com -sSfL | sh
```

### "Not logged into Okteto cluster"
```bash
# Login to Okteto
okteto context use https://cloud.okteto.com
```

### "Failed to clone repository"
Check internet connection and GitHub access.

### "Timeout waiting for ready state"
- Cluster may be slow or overloaded
- Check Okteto CLI version compatibility
- Verify namespace has sufficient resources

### Tests pass but screenshots still created
Old screenshots from previous failed runs. Clean up:
```bash
rm -rf smoke-test-screenshots/
```

## Files

```
scripts/
├── smoke-test.sh              # Main orchestration script
└── README_SMOKE_TEST.md       # This file

src/test/smoke/
├── smoke.test.ts              # Test suite
├── runTest.ts                 # Test runner
└── index.ts                   # Mocha configuration
```

## Maintenance

### Update Test Repository
If okteto/movies changes structure:
1. Update `TEST_SERVICE` in script
2. Update service selection logic in smoke.test.ts
3. Test locally before committing

### Update Timeouts
If Okteto operations become slower:
1. Increase timeout in smoke.test.ts
2. Increase poll interval if needed

### Add More Tests
Add test cases to `smoke.test.ts`:
```typescript
test('Test deploy command', async function() {
    await vscode.commands.executeCommand('okteto.deploy');
    // verification logic
});
```

## Best Practices

1. **Run before releases** - Validate end-to-end functionality
2. **Keep namespace clean** - Let script handle cleanup
3. **Review screenshots** - Check for UI issues on failures
4. **Update regularly** - Keep test repo and scenarios current
5. **Don't commit .vsix** - Built fresh each run

## Support

For issues with the smoke test:
1. Check prerequisites are met
2. Review error messages and screenshots
3. Inspect test namespace if preserved
4. Check Okteto cluster status
5. Report issues with full logs
