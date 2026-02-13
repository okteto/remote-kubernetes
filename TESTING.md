# Manual Testing Checklist - Pre-Release

Use this checklist before releasing a new version of the Remote - Kubernetes extension.

**Version being tested:** `_______`
**Tester:** `_______`
**Date:** `_______`
**Platform:** `_______` (macOS / Windows / Linux)

---

## 🔴 Critical Path Testing (MUST TEST)

### 1. Core Workflow: Okteto Up
**Prerequisites:** Active Kubernetes cluster, project with `okteto.yml`

- [ ] Open VS Code in project with `okteto.yml` or `docker-compose.yml`
- [ ] Run command: `Okteto: Up`
- [ ] Manifest picker shows available manifests
- [ ] Select manifest successfully
- [ ] Service picker appears (if multiple services)
- [ ] Progress notifications display correctly
- [ ] **NEW:** Open Output panel → "Okteto" - logs appear with severity levels
- [ ] SSH connection establishes (if Remote-SSH enabled)
- [ ] Development environment activates
- [ ] Code change syncs to container
- [ ] Terminal opens with correct name (`okteto-namespace-service`)

**Issues found:**
```


```

### 2. Core Workflow: Okteto Down
**Prerequisites:** Active `okteto up` session

- [ ] Run command: `Okteto: Down`
- [ ] Environment tears down cleanly
- [ ] No lingering processes
- [ ] Output panel shows clean shutdown logs
- [ ] Success message appears

**Issues found:**
```


```

### 3. Context and Namespace Switching
**Focus:** File watcher memory leak fixes

- [ ] Run command: `Okteto: Set the context for all the Okteto commands`
- [ ] Switch to different context
- [ ] Success message appears
- [ ] No hanging file watchers
- [ ] Run command: `Okteto: Set the namespace for all the Okteto commands`
- [ ] Switch namespace successfully
- [ ] Output panel shows completion

**Issues found:**
```


```

---

## 🟡 Important Testing (SHOULD TEST)

### 4. Extension Activation & Commands

- [ ] Open VS Code fresh window
- [ ] Extension activates without errors
- [ ] Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
- [ ] Type "Okteto" - all 8 commands appear:
  - [ ] Okteto: Up
  - [ ] Okteto: Down
  - [ ] Okteto: Install
  - [ ] Okteto: Deploy your development environment
  - [ ] Okteto: Destroy your development environment
  - [ ] Okteto: Run your tests on your development environment
  - [ ] Okteto: Set the context for all the Okteto commands
  - [ ] Okteto: Set the namespace for all the Okteto commands
- [ ] Open Developer Tools (Help → Toggle Developer Tools)
- [ ] Check Console tab - no errors

**Issues found:**
```


```

### 5. Telemetry Compliance

- [ ] Open Settings → Search "telemetry"
- [ ] Note current telemetry setting: `_______`
- [ ] **With telemetry ENABLED:**
  - [ ] Run any Okteto command
  - [ ] No errors occur
  - [ ] Command executes normally
- [ ] **With telemetry DISABLED:**
  - [ ] Disable telemetry in VS Code settings
  - [ ] Run any Okteto command
  - [ ] Still works correctly
  - [ ] No telemetry errors in Output panel

**Issues found:**
```


```

### 6. Logging System
**Focus:** New LogOutputChannel implementation

- [ ] Open Output panel (View → Output)
- [ ] Select "Okteto" from dropdown
- [ ] Run `Okteto: Up`
- [ ] Logs appear in Output panel
- [ ] Different severity levels visible (info, debug, error)
- [ ] Run `Okteto: Down`
- [ ] Completion logs appear
- [ ] Open Developer Tools Console
- [ ] **Verify:** No console.log/error remnants (should be clean)

**Issues found:**
```


```

### 7. Error Handling

#### Test 7a: Missing Okteto CLI
- [ ] Temporarily uninstall/rename Okteto CLI binary
- [ ] Run `Okteto: Up`
- [ ] Installation prompt appears
- [ ] Automatic installation offered
- [ ] Error message is user-friendly
- [ ] Output panel shows helpful details
- [ ] Restore Okteto CLI

**Issues found:**
```


```

#### Test 7b: Invalid Manifest
- [ ] Create malformed `okteto.yml` (invalid YAML)
- [ ] Run `Okteto: Up`
- [ ] Error message is clear and user-friendly
- [ ] Output panel shows details
- [ ] No stack traces in UI
- [ ] No infinite recursion errors (bug we fixed!)

**Issues found:**
```


```

#### Test 7c: No Context Set
- [ ] Clear Okteto context (if possible)
- [ ] Run `Okteto: Up`
- [ ] Prompts to set context
- [ ] Error handling is graceful

**Issues found:**
```


```

---

## 🟢 Nice to Have Testing (OPTIONAL)

### 8. Multiple Manifests

#### Test 8a: Standard Manifests
- [ ] Create project with multiple manifests:
  - [ ] `okteto.yml`
  - [ ] `okteto-pipeline.yml`
  - [ ] `docker-compose.yml`
- [ ] Run `Okteto: Up`
- [ ] Picker shows all manifests
- [ ] Manifests sorted by depth (shallower first)
- [ ] Selection works correctly

#### Test 8b: Custom Pattern Manifests
- [ ] Create project with custom pattern manifests:
  - [ ] `okteto.dev.yml`
  - [ ] `okteto.staging.yml`
  - [ ] `okteto-stack.yml`
  - [ ] `okteto-frontend.yml`
- [ ] Run `Okteto: Deploy`
- [ ] Picker shows all custom manifests
- [ ] Run `Okteto: Up`
- [ ] Picker shows all custom manifests (same as Deploy)

#### Test 8c: Mixed Manifests
- [ ] Create project with mix:
  - [ ] `okteto.yml`
  - [ ] `okteto.dev.yml`
  - [ ] `okteto-pipeline.yml`
  - [ ] `okteto-custom.yaml`
- [ ] Run `Okteto: Up` - should show all manifests
- [ ] Run `Okteto: Deploy` - should show all manifests
- [ ] Verify both commands show the same manifest list

**Issues found:**
```


```

### 9. Deploy and Destroy

- [ ] Run `Okteto: Deploy your development environment`
- [ ] Terminal opens with deploy command
- [ ] Command executes
- [ ] Run `Okteto: Destroy your development environment`
- [ ] Terminal opens with destroy command
- [ ] Cleanup completes

**Issues found:**
```


```

### 10. Test Command

- [ ] Use project with tests defined in okteto.yml
- [ ] Run `Okteto: Run your tests on your development environment`
- [ ] Test picker appears
- [ ] Select test (or "All tests")
- [ ] Terminal opens and tests run

**Issues found:**
```


```

### 11. Platform-Specific Testing

**Windows only:**
- [ ] Test Git Bash path conversion (`toGitBash` function)
- [ ] Enable "Git Bash mode" setting
- [ ] Run `Okteto: Up`
- [ ] Paths converted correctly (C:\path → /c/path)

**All platforms:**
- [ ] Binary installation works
- [ ] Path handling correct
- [ ] No platform-specific errors

**Issues found:**
```


```

---

## 📋 Quick Smoke Test (5 minutes)

Use this for rapid verification:

- [ ] Install extension from .vsix: `code --install-extension remote-kubernetes-X.X.X.vsix`
- [ ] Open project with okteto.yml
- [ ] Run "Okteto: Up" - verify it starts
- [ ] Open Output panel → "Okteto" - verify logs appear
- [ ] Wait for "ready" state
- [ ] Run "Okteto: Down" - verify cleanup
- [ ] Run "Okteto: Set the context" - verify context switching works
- [ ] Check Developer Tools console - verify no errors

**Issues found:**
```


```

---

## 🐛 Regression Watch List

Based on bugs fixed in recent PRs, specifically watch for:

- [ ] **File watcher leaks:** Context/namespace switching completes cleanly (PR #269)
- [ ] **Infinite recursion:** Error messages display without crashing (PR #273)
- [ ] **Sleep timing:** Timeouts respect configured values (PR #269)
- [ ] **splitStateError:** Colons in error messages preserved (PR #269)
- [ ] **Telemetry disposal:** No memory leaks from telemetry listener (PR #272)
- [ ] **Pipeline errors:** stream/promises pipeline doesn't hang (PR #274)

**Issues found:**
```


```

---

## 📦 Pre-Release Verification

### Build Verification
```bash
# 1. Verify version number
cat package.json | grep version
# Expected: "version": "X.X.X"

# 2. Run full test suite
npm run lint          # Should have 11 warnings (expected)
npm test              # Should have 52 passing
npm run test:e2e      # Should have 10 passing

# 3. Build and inspect package
npm run package
# Should create remote-kubernetes-X.X.X.vsix
# Should be ~1.59 MB
```

- [ ] Version number correct in package.json
- [ ] Lint: 11 warnings (expected)
- [ ] Unit tests: 52 passing
- [ ] E2E tests: 10 passing
- [ ] Package builds: ~1.59 MB
- [ ] CHANGELOG.md updated for this version
- [ ] No uncommitted changes

### Installation Test
```bash
# Install .vsix in clean VS Code instance
code --install-extension remote-kubernetes-X.X.X.vsix
```

- [ ] Installation succeeds
- [ ] Extension shows in Extensions panel
- [ ] Version number matches

---

## ✅ Sign-Off

**Critical Path:** ☐ Pass  ☐ Fail
**Important Tests:** ☐ Pass  ☐ Fail  ☐ Skipped
**Optional Tests:** ☐ Pass  ☐ Fail  ☐ Skipped
**Pre-Release:** ☐ Pass  ☐ Fail

**Overall Status:** ☐ Ready for Release  ☐ Issues Found - Fix Required

**Notes:**
```



```

**Tested by:** `_______`
**Date:** `_______`
**Approved for release:** ☐ Yes  ☐ No
