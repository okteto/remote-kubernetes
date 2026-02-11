# AGENT.md - Remote Kubernetes VS Code Extension

## Project Overview

This is a **VS Code extension** called "Remote - Kubernetes" that wraps the [Okteto CLI](https://okteto.com) to provide remote Kubernetes development environments directly from VS Code. It manages the full lifecycle: deploying dev environments, syncing code, connecting via SSH, and cleanup.

**Publisher:** Okteto
**Repository:** https://github.com/okteto/remote-kubernetes
**License:** Apache 2.0

## Quick Reference

```bash
npm run compile       # Build (development mode via webpack)
npm test              # Run tests (compiles first via pretest hook)
npm run watch         # Build + watch for changes
npm run package       # Create .vsix extension package
npm run ci            # Full CI pipeline: install + test + package
```

## Architecture

### Source Layout

```
src/
├── extension.ts      # Main entry point. Registers all VS Code commands, orchestrates workflows
├── okteto.ts         # Okteto CLI wrapper. Spawns CLI processes, monitors state via terminal
├── ssh.ts            # SSH readiness checks and port discovery
├── telemetry.ts      # Analytics (Mixpanel) and error tracking (Sentry)
├── manifest.ts       # YAML manifest parsing (Okteto v2, Docker Compose)
├── download.ts       # Downloads Okteto CLI binary per platform
├── machineid.ts      # Platform-specific machine ID generation
├── paths.ts          # Git Bash path conversion (Windows support)
├── typings/          # TypeScript type definitions
└── test/
    └── suite/
        ├── manifest.test.ts   # Manifest parsing tests
        ├── paths.test.ts      # Path utility tests
        ├── machineid.test.ts  # Machine ID tests
        └── artifacts/         # Test fixture YAML files
```

### Build Pipeline

- **Bundler:** Webpack (`webpack.config.js`)
- **Entry:** `src/extension.ts` → **Output:** `dist/extension.js` (CommonJS, Node.js target)
- **TypeScript:** Strict mode, ES6 target, NodeNext modules
- The `vscode` module is externalized (provided by VS Code at runtime)

### Key Extension Commands

| Command | ID | Description |
|---------|-----|------------|
| Okteto: Up | `okteto.up` | Launch a dev environment |
| Okteto: Down | `okteto.down` | Stop a dev environment |
| Okteto: Deploy | `okteto.deploy` | Deploy dev environment |
| Okteto: Destroy | `okteto.destroy` | Destroy dev environment |
| Okteto: Test | `okteto.test` | Run tests in dev environment |
| Okteto: Install | `okteto.install` | Install Okteto CLI |
| Okteto: Set Context | `okteto.context` | Configure Okteto context |
| Okteto: Set Namespace | `okteto.namespace` | Configure Okteto namespace |

### Extension Configuration Options

Defined in `package.json` under `contributes.configuration`:
- `okteto.binary` - Path to Okteto CLI executable
- `okteto.remoteSSH` - Use VS Code Remote-SSH (default: true)
- `okteto.telemetry` - Enable analytics (default: true)
- `okteto.gitBash` - Windows Git Bash path support (default: false)
- `okteto.upArgs` - Extra args for `okteto up` (default: `--log-level=warn`)
- `okteto.upTimeout` - Timeout in seconds (default: 100)

## Testing

**Framework:** Mocha + Chai + ts-node

```bash
npm test    # Runs: mocha -r ts-node/register src/test/suite/*.test.ts
```

Tests are plain TypeScript files in `src/test/suite/`. They do **not** require a running VS Code instance (no `@vscode/test-electron` bootstrapping for unit tests). Test fixtures (YAML manifests) live in `src/test/suite/artifacts/`.

When adding tests, place them in `src/test/suite/` with the naming convention `*.test.ts`.

## Code Conventions

- **Language:** TypeScript with strict mode
- **Style:** camelCase for functions/variables, PascalCase for classes
- **Semicolons:** Always required
- **Equality:** Use `===` (no `==`)
- **Curly braces:** Always required for control structures
- **Async:** Use async/await throughout (no raw Promises)
- **Linting:** ESLint (v9); legacy `tslint.json` still exists but TSLint is deprecated
- **Module system:** ESM-style imports compiled to CommonJS via webpack

## Dependencies of Note

| Package | Purpose |
|---------|---------|
| `execa` | Execute Okteto CLI commands as child processes |
| `got` | HTTP client for downloading CLI binaries |
| `yaml` | Parse Okteto and Docker Compose manifests |
| `semver` | Version comparison for CLI update checks |
| `@sentry/node` | Error tracking and crash reporting |
| `mixpanel` | Usage telemetry |
| `tcp-ping` | SSH readiness checks |
| `get-port` | Find available network ports |

## CI/CD

- **CI:** GitHub Actions (`.github/workflows/nodejs.yml`) - runs on every push, Node 22, Ubuntu
- **Publish:** `.github/workflows/publish.yml` - triggered on GitHub release, publishes to VS Code Marketplace via `vsce`
- **Security:** CodeQL analysis on PRs to main + weekly schedule

## Release Process

1. Update `version` in `package.json`
2. Update `CHANGELOG.md`
3. Create a GitHub release with a tag
4. CI automatically builds, tests, and publishes to the VS Code Marketplace
5. Sentry source maps are uploaded for error tracking

## Common Tasks

### Adding a new VS Code command
1. Register the command in `package.json` under `contributes.commands`
2. Implement the handler in `src/extension.ts` using `vscode.commands.registerCommand`
3. If it needs a menu entry, add it to `contributes.menus` in `package.json`

### Updating minimum Okteto CLI version
- Change the `minVersion` constant in `src/extension.ts`
- Update `CHANGELOG.md`

### Adding a new test
- Create `src/test/suite/<name>.test.ts`
- Use Chai's `expect` for assertions
- Place fixture files in `src/test/suite/artifacts/`

### Modifying manifest parsing
- Edit `src/manifest.ts`
- Supported formats: Okteto v2 manifests and Docker Compose files
- Tests in `src/test/suite/manifest.test.ts` with YAML fixtures in `artifacts/`
