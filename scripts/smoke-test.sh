#!/bin/bash
# Automated Smoke Test for Remote - Kubernetes Extension
# Tests the extension end-to-end using the okteto/movies repository

set -e  # Exit on error

# Configuration
NAMESPACE_PREFIX="okteto-smoke-test"
MOVIES_REPO="https://github.com/okteto/movies"
TEST_SERVICE="catalog"
TEMP_DIR=""
NAMESPACE=""
VSIX_FILE=""
TEST_FAILED=0

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# Step 1: Check prerequisites
check_prerequisites() {
    log_step "Checking prerequisites..."

    # Check okteto CLI
    if ! command -v okteto &> /dev/null; then
        log_error "Okteto CLI not found. Please install it first."
        exit 1
    fi
    log_info "✓ Okteto CLI found: $(okteto version)"

    # Check if logged in (try to get current context)
    if ! okteto context show &> /dev/null; then
        log_error "Not logged into Okteto cluster. Run 'okteto context' first."
        exit 1
    fi
    log_info "✓ Logged into Okteto: $(okteto context show --output json | grep name | cut -d'"' -f4)"

    # Check Node.js and npm
    if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
        log_error "Node.js/npm not found."
        exit 1
    fi
    log_info "✓ Node.js found: $(node --version)"
    log_info "✓ npm found: $(npm --version)"

    # Check git
    if ! command -v git &> /dev/null; then
        log_error "git not found."
        exit 1
    fi
    log_info "✓ git found: $(git --version | head -n1)"

    log_info "Prerequisites OK"
    echo ""
}

# Step 2: Create test namespace
create_test_namespace() {
    NAMESPACE="${NAMESPACE_PREFIX}-$(date +%s)"
    log_step "Creating test namespace: $NAMESPACE"

    # Create namespace
    if okteto namespace create "$NAMESPACE" 2>&1 | grep -q "already exists"; then
        log_warn "Namespace already exists, using it"
    fi

    # Switch to the namespace
    okteto namespace use "$NAMESPACE" || {
        log_error "Failed to switch to namespace"
        exit 1
    }

    log_info "✓ Namespace created and activated: $NAMESPACE"
    echo ""
}

# Step 3: Clone movies repository
setup_test_repo() {
    log_step "Setting up test repository..."

    TEMP_DIR=$(mktemp -d)
    log_info "Cloning movies repo to: $TEMP_DIR"

    git clone --depth 1 "$MOVIES_REPO" "$TEMP_DIR/movies" 2>&1 | grep -v "Cloning into" || true

    if [ ! -d "$TEMP_DIR/movies/catalog" ]; then
        log_error "Failed to clone repository or catalog directory not found"
        cleanup
        exit 1
    fi

    log_info "✓ Repository cloned successfully"
    log_info "✓ Movies repository at: $TEMP_DIR/movies"
    echo ""
}

# Step 4: Build extension
build_extension() {
    log_step "Building extension..."

    # Clean old builds
    rm -f remote-kubernetes-*.vsix

    # Build the extension
    npm run package > /dev/null 2>&1 || {
        log_error "Failed to build extension"
        cleanup
        exit 1
    }

    # Find the .vsix file
    VSIX_FILE=$(ls remote-kubernetes-*.vsix 2>/dev/null | head -n 1)

    if [ -z "$VSIX_FILE" ]; then
        log_error "No .vsix file found after build"
        cleanup
        exit 1
    fi

    VSIX_SIZE=$(du -h "$VSIX_FILE" | cut -f1)
    log_info "✓ Extension built: $VSIX_FILE ($VSIX_SIZE)"
    echo ""
}

# Step 5: Run smoke tests
run_smoke_tests() {
    log_step "Running smoke tests..."

    # Set environment variables for test
    # Note: Open root movies directory, not catalog subdirectory (okteto.yml is at root)
    export SMOKE_TEST_WORKSPACE="$TEMP_DIR/movies"
    export SMOKE_TEST_VSIX="$(pwd)/$VSIX_FILE"
    export SMOKE_TEST_NAMESPACE="$NAMESPACE"
    export SMOKE_TEST_SERVICE="$TEST_SERVICE"
    export SMOKE_TEST_SCREENSHOTS="$(pwd)/smoke-test-screenshots"

    # Create screenshots directory
    mkdir -p "$SMOKE_TEST_SCREENSHOTS"

    log_info "Test configuration:"
    log_info "  Workspace: $SMOKE_TEST_WORKSPACE (movies repo root)"
    log_info "  Extension: $VSIX_FILE"
    log_info "  Namespace: $NAMESPACE"
    log_info "  Service: $TEST_SERVICE (catalog)"
    log_info "  Screenshots: $SMOKE_TEST_SCREENSHOTS"
    echo ""

    # Run the smoke test suite
    if npm run test:smoke; then
        log_info "✓ Smoke tests passed!"
        TEST_FAILED=0
    else
        log_error "✗ Smoke tests failed!"
        TEST_FAILED=1
    fi
    echo ""
}

# Step 6: Cleanup
cleanup() {
    log_step "Cleaning up..."

    # Delete namespace only on success
    if [ -n "$NAMESPACE" ]; then
        if [ $TEST_FAILED -eq 0 ]; then
            log_info "Deleting namespace: $NAMESPACE (tests passed)"
            okteto namespace delete "$NAMESPACE" 2>&1 | grep -v "Deleting" || log_warn "Failed to delete namespace"
        else
            log_warn "Keeping namespace for debugging: $NAMESPACE (tests failed)"
            log_warn "To delete manually: okteto namespace delete $NAMESPACE"
        fi
    fi

    # Remove temp directory
    if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
        log_info "Removing temp directory: $TEMP_DIR"
        rm -rf "$TEMP_DIR"
    fi

    # Report screenshots if any
    if [ -d "smoke-test-screenshots" ]; then
        SCREENSHOT_COUNT=$(ls smoke-test-screenshots/*.png 2>/dev/null | wc -l | tr -d ' ')
        if [ "$SCREENSHOT_COUNT" -gt 0 ]; then
            log_info "Screenshots saved: $SCREENSHOT_COUNT files in smoke-test-screenshots/"
        else
            rm -rf smoke-test-screenshots
        fi
    fi
}

# Trap cleanup on exit
trap cleanup EXIT

# Main execution
main() {
    echo ""
    echo "=========================================="
    echo "  Automated Smoke Test"
    echo "  Remote - Kubernetes Extension"
    echo "=========================================="
    echo ""

    check_prerequisites
    create_test_namespace
    setup_test_repo
    build_extension
    run_smoke_tests

    echo "=========================================="
    if [ $TEST_FAILED -eq 0 ]; then
        log_info "✓ Smoke test completed successfully!"
    else
        log_error "✗ Smoke test failed - see output above"
        exit 1
    fi
    echo "=========================================="
    echo ""
}

main
