# Automated Smoke Test - Implementation Plan

## Goal
Automate the Quick Smoke Test Checklist to run on macOS using the okteto/movies repository.

## Requirements
- ✅ Run on macOS
- ✅ Execute manually (not in CI)
- ✅ Use https://github.com/okteto/movies as test repository
- ✅ Test with `catalog` service from movies repo
- ✅ Assume user already logged into Okteto cluster
- ✅ Create dedicated test namespace
- ✅ Use VS Code extension commands (not CLI directly)

## Architecture

### Two-Component Approach

#### 1. Bash Orchestration Script
**Location:** `scripts/smoke-test.sh`

**Responsibilities:**
- Environment validation (okteto CLI installed, logged in)
- Namespace creation (`okteto-smoke-test-{timestamp}`)
- Test repository setup (clone movies repo)
- Extension packaging (build .vsix)
- Test execution (run E2E smoke tests)
- Cleanup (delete namespace, temp files)
- Results reporting

#### 2. E2E Test Suite
**Location:** `src/test/smoke/smoke.test.ts`

**Responsibilities:**
- VS Code automation
- Extension command execution
- Output panel verification
- State validation
- Error detection

## Implementation Details

### Component 1: Orchestration Script (`scripts/smoke-test.sh`)

```bash
#!/bin/bash
# Automated Smoke Test for Remote - Kubernetes Extension

set -e  # Exit on error

# Configuration
NAMESPACE_PREFIX="okteto-smoke-test"
MOVIES_REPO="https://github.com/okteto/movies"
TEST_SERVICE="catalog"
TEMP_DIR=""

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Step 1: Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check okteto CLI
    if ! command -v okteto &> /dev/null; then
        log_error "Okteto CLI not found. Please install it first."
        exit 1
    fi

    # Check if logged in (try to get current context)
    if ! okteto context show &> /dev/null; then
        log_error "Not logged into Okteto cluster. Run 'okteto context' first."
        exit 1
    fi

    # Check Node.js and npm
    if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
        log_error "Node.js/npm not found."
        exit 1
    fi

    log_info "Prerequisites OK"
}

# Step 2: Create test namespace
create_test_namespace() {
    NAMESPACE="${NAMESPACE_PREFIX}-$(date +%s)"
    log_info "Creating test namespace: $NAMESPACE"

    # Create namespace (this will also switch to it)
    okteto namespace create "$NAMESPACE" || {
        log_error "Failed to create namespace"
        exit 1
    }

    log_info "Namespace created and activated: $NAMESPACE"
}

# Step 3: Clone movies repository
setup_test_repo() {
    log_info "Setting up test repository..."

    TEMP_DIR=$(mktemp -d)
    log_info "Cloning movies repo to: $TEMP_DIR"

    git clone --depth 1 "$MOVIES_REPO" "$TEMP_DIR/movies" || {
        log_error "Failed to clone repository"
        cleanup
        exit 1
    }

    log_info "Repository cloned successfully"
}

# Step 4: Build extension
build_extension() {
    log_info "Building extension..."

    # Run from extension directory
    npm run package || {
        log_error "Failed to build extension"
        cleanup
        exit 1
    }

    # Find the .vsix file
    VSIX_FILE=$(ls remote-kubernetes-*.vsix | head -n 1)

    if [ -z "$VSIX_FILE" ]; then
        log_error "No .vsix file found"
        cleanup
        exit 1
    fi

    log_info "Extension built: $VSIX_FILE"
}

# Step 5: Run smoke tests
run_smoke_tests() {
    log_info "Running smoke tests..."

    # Set environment variables for test
    export SMOKE_TEST_WORKSPACE="$TEMP_DIR/movies/catalog"
    export SMOKE_TEST_VSIX="$(pwd)/$VSIX_FILE"
    export SMOKE_TEST_NAMESPACE="$NAMESPACE"
    export SMOKE_TEST_SERVICE="$TEST_SERVICE"

    # Run the smoke test suite
    npm run test:smoke || {
        log_error "Smoke tests failed"
        cleanup
        exit 1
    }

    log_info "Smoke tests passed!"
}

# Step 6: Cleanup
cleanup() {
    log_info "Cleaning up..."

    # Delete namespace if created
    if [ -n "$NAMESPACE" ]; then
        log_info "Deleting namespace: $NAMESPACE"
        okteto namespace delete "$NAMESPACE" --force || log_warn "Failed to delete namespace"
    fi

    # Remove temp directory
    if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
        log_info "Removing temp directory: $TEMP_DIR"
        rm -rf "$TEMP_DIR"
    fi

    # Switch back to original namespace (if possible)
    # okteto namespace use <original> || log_warn "Could not switch back to original namespace"
}

# Trap cleanup on exit
trap cleanup EXIT

# Main execution
main() {
    log_info "Starting Automated Smoke Test"
    log_info "=============================="

    check_prerequisites
    create_test_namespace
    setup_test_repo
    build_extension
    run_smoke_tests

    log_info "=============================="
    log_info "Smoke test completed successfully!"
}

main
```

### Component 2: E2E Smoke Test (`src/test/smoke/smoke.test.ts`)

```typescript
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('Smoke Test Suite', function() {
    // Longer timeout for real Okteto operations
    this.timeout(5 * 60 * 1000); // 5 minutes

    const namespace = process.env.SMOKE_TEST_NAMESPACE!;
    const service = process.env.SMOKE_TEST_SERVICE!;

    test('Full smoke test workflow', async () => {
        // 1. Verify extension is active
        const ext = vscode.extensions.getExtension('okteto.remote-kubernetes');
        assert.ok(ext, 'Extension should be installed');

        await ext.activate();
        assert.ok(ext.isActive, 'Extension should be active');

        // 2. Get Output channel
        const outputChannel = vscode.window.createOutputChannel('Okteto');
        assert.ok(outputChannel, 'Output channel should exist');

        // 3. Execute Okteto: Up
        // Note: This will require user interaction for manifest/service selection
        // We'll need to handle this programmatically

        await vscode.commands.executeCommand('okteto.up');

        // 4. Wait for ready state
        // Poll the state file or watch for terminal output
        await waitForReadyState(namespace, service);

        // 5. Verify logs in Output panel
        // Check that logs contain expected messages

        // 6. Execute Okteto: Down
        await vscode.commands.executeCommand('okteto.down');

        // 7. Verify cleanup
        await waitForCleanup(namespace, service);

        // 8. Test context switching
        const currentContext = await getCurrentContext();
        await vscode.commands.executeCommand('okteto.context');
        // Verify no errors
    });

    async function waitForReadyState(namespace: string, service: string): Promise<void> {
        // Poll okteto state file
        const maxWait = 3 * 60 * 1000; // 3 minutes
        const interval = 2000; // 2 seconds
        const startTime = Date.now();

        while (Date.now() - startTime < maxWait) {
            // Check state file in ~/.okteto/{namespace}/{service}/okteto.state
            const state = await checkOktetoState(namespace, service);

            if (state === 'ready') {
                return;
            }

            if (state === 'failed') {
                throw new Error('Okteto up failed');
            }

            await sleep(interval);
        }

        throw new Error('Timeout waiting for ready state');
    }

    async function checkOktetoState(namespace: string, service: string): Promise<string> {
        // Read state file
        // Return state string
        // Implementation needed
        return 'ready';
    }

    async function waitForCleanup(namespace: string, service: string): Promise<void> {
        // Wait for cleanup to complete
        await sleep(5000);
    }

    async function getCurrentContext(): Promise<string> {
        // Get current okteto context
        return '';
    }

    function sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
});
```

### Component 3: Test Runner (`src/test/smoke/runTest.ts`)

```typescript
import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
    try {
        const extensionDevelopmentPath = path.resolve(__dirname, '../../../');
        const extensionTestsPath = path.resolve(__dirname, './smoke.test');
        const testWorkspace = process.env.SMOKE_TEST_WORKSPACE!;
        const vsixPath = process.env.SMOKE_TEST_VSIX!;

        // Install extension from .vsix before running tests
        const vscodeExecutablePath = await downloadAndUnzipVSCode();
        await installExtension(vscodeExecutablePath, vsixPath);

        await runTests({
            vscodeExecutablePath,
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [
                testWorkspace,
                '--disable-extensions', // Disable other extensions
            ],
        });
    } catch (err) {
        console.error('Failed to run smoke tests:', err);
        process.exit(1);
    }
}

main();
```

## Challenges & Solutions

### Challenge 1: User Interaction for Manifest/Service Selection
**Problem:** `okteto.up` shows quick picks that require user interaction

**Solutions:**
- **Option A:** Mock the quick pick in test
- **Option B:** Pre-select via command arguments (need to modify extension)
- **Option C:** Use headless automation (simulate clicks)
- **Recommended:** Option A - Mock vscode.window.showQuickPick in test

### Challenge 2: Verifying Output Panel Content
**Problem:** Can't easily read Output panel programmatically

**Solutions:**
- **Option A:** Access the logger module directly
- **Option B:** Read log files if they exist
- **Option C:** Check state files instead
- **Recommended:** Option C - Verify state files + no errors

### Challenge 3: Waiting for Okteto Ready State
**Problem:** Need to poll state file

**Solutions:**
- Import okteto.ts functions directly in test
- Use same logic as extension
- **Recommended:** Reuse getState() from okteto.ts

## Files to Create

```
remote-kubernetes/
├── scripts/
│   └── smoke-test.sh                    # Main orchestration script
├── src/
│   └── test/
│       └── smoke/
│           ├── smoke.test.ts            # Smoke test suite
│           └── runTest.ts               # Test runner
└── package.json                          # Add test:smoke script
```

## package.json Changes

```json
{
  "scripts": {
    "test:smoke": "ts-node src/test/smoke/runTest.ts"
  }
}
```

## Usage

```bash
# From extension root directory
./scripts/smoke-test.sh

# Expected output:
# [INFO] Checking prerequisites...
# [INFO] Prerequisites OK
# [INFO] Creating test namespace: okteto-smoke-test-1234567890
# [INFO] Namespace created and activated
# [INFO] Cloning movies repo...
# [INFO] Building extension...
# [INFO] Running smoke tests...
# [INFO] Smoke tests passed!
# [INFO] Cleaning up...
# [INFO] Smoke test completed successfully!
```

## Estimated Complexity

- **Bash script:** 2-3 hours
  - Prerequisites check: 30 min
  - Namespace management: 30 min
  - Repo setup: 30 min
  - Integration: 1-2 hours

- **E2E test:** 3-4 hours
  - Test infrastructure: 1 hour
  - Command execution: 1 hour
  - State polling: 1 hour
  - Verification: 1 hour

- **Testing & debugging:** 2-3 hours

**Total:** 7-10 hours

## Next Steps

1. ✅ Create TESTING.md (manual checklist) - DONE
2. ✅ Create SMOKE_TEST_PLAN.md (this file) - DONE
3. Create `scripts/smoke-test.sh`
4. Create `src/test/smoke/smoke.test.ts`
5. Create `src/test/smoke/runTest.ts`
6. Update `package.json` with `test:smoke` script
7. Test the smoke test script
8. Document any issues/limitations

## Limitations

1. **Interactive prompts:** Some extension commands may still require user interaction
2. **Timing sensitivity:** Real Okteto operations can be slow/flaky
3. **Network dependency:** Requires active internet and Okteto cluster
4. **macOS only:** Script designed for macOS (can be adapted for Linux/Windows)
5. **Manual execution:** Not integrated into CI (by design)

## Future Enhancements

- Add verbose mode for debugging
- Support multiple test repositories
- Parallel test execution
- Integration with CI (optional)
- Screenshot capture on failure
- Performance metrics collection
