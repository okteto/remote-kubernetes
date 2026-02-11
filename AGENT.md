# AGENT.md - Remote Kubernetes VS Code Extension

## Project Overview

This is a **VS Code extension** called "Remote - Kubernetes" that wraps the [Okteto CLI](https://okteto.com) to provide remote Kubernetes development environments directly from VS Code. It manages the full lifecycle: deploying dev environments, syncing code, connecting via SSH, and cleanup.

**Publisher:** Okteto
**Repository:** https://github.com/okteto/remote-kubernetes
**License:** Apache 2.0

## Quick Reference

```bash
npm run compile       # Build (development mode via webpack)
npm test              # Run unit tests (compiles first via pretest hook)
npm run test:e2e      # Run e2e tests (compiles with tsc, launches VS Code)
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
    ├── suite/                   # Unit tests (run in plain Node.js)
    │   ├── manifest.test.ts
    │   ├── paths.test.ts
    │   ├── machineid.test.ts
    │   └── artifacts/           # Test fixture YAML files
    └── e2e/                     # End-to-end tests (run inside VS Code)
        ├── runTest.ts           # Launcher: downloads VS Code via @vscode/test-electron
        ├── index.ts             # Mocha bootstrap for extension host (TDD interface)
        └── extension.test.ts    # Validates extension activation and command registration
```

### Build Pipeline

- **Bundler:** Webpack (`webpack.config.js`)
- **Entry:** `src/extension.ts` → **Output:** `dist/extension.js` (CommonJS, Node.js target)
- **TypeScript:** Strict mode, ES6 target, NodeNext modules
- The `vscode` module is externalized (provided by VS Code at runtime)
- **E2E tests use `tsc`** (not webpack) via `tsconfig.test.json` because `@vscode/test-electron` needs individual `.js` files, not a bundle. The `tsconfig.test.json` extends the main config and adds `skipLibCheck: true` to avoid transitive type conflicts from `@types/eslint-scope` and `@types/glob`.

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

### Unit Tests

**Framework:** Mocha + Chai + ts-node

```bash
npm test    # Runs: mocha -r ts-node/register src/test/suite/*.test.ts
```

Unit tests are plain TypeScript files in `src/test/suite/`. They do **not** require a running VS Code instance. Test fixtures (YAML manifests) live in `src/test/suite/artifacts/`.

### End-to-End Tests

**Framework:** @vscode/test-electron + Mocha (TDD interface)

```bash
npm run test:e2e    # Compiles with tsc, then launches VS Code with the extension
```

E2E tests live in `src/test/e2e/`. They run inside a real VS Code instance and have access to the full `vscode` API. The tests use `suite`/`test` (TDD) syntax, not `describe`/`it` (BDD).

The e2e Mocha bootstrap is in `src/test/e2e/index.ts` and uses the **TDD** UI (`ui: 'tdd'`).

### Adding Tests

**Unit test:** Create `src/test/suite/<name>.test.ts`, use Chai `expect` assertions with BDD syntax (`describe`/`it`).

**E2e test:** Create `src/test/e2e/<name>.test.ts`, use Node.js `assert` with TDD syntax (`suite`/`test`). The file will be auto-discovered by the glob in `index.ts`.

## Code Conventions

- **Language:** TypeScript with strict mode
- **Style:** camelCase for functions/variables, PascalCase for classes
- **Semicolons:** Always required
- **Equality:** Use `===` (no `==`)
- **Curly braces:** Always required for control structures
- **Async:** Use async/await throughout (no raw Promises)
- **Linting:** ESLint v10; legacy `tslint.json` still exists but TSLint is deprecated
- **Module system:** ESM-style imports compiled to CommonJS via webpack

## Dependencies of Note

| Package | Purpose |
|---------|---------|
| `execa` | Execute Okteto CLI commands as child processes |
| `got` | HTTP client for downloading CLI binaries |
| `yaml` | Parse Okteto and Docker Compose manifests |
| `semver` | Version comparison for CLI update checks |
| `@sentry/node` | Error tracking and crash reporting |
| `@sentry/cli` | Sentry release management (source map uploads) |
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
5. Sentry source maps are uploaded via `sentry-cli sourcemaps upload`

## GitHub Workflow

- **Branch protection:** PRs to `main` require passing checks; admin privileges needed to bypass review
- **Merge strategy:** Squash merges only (merge commits are disabled)
- Use `gh pr merge --squash` (not `--merge`)

## Common Tasks

### Adding a new VS Code command
1. Register the command in `package.json` under `contributes.commands`
2. Implement the handler in `src/extension.ts` using `vscode.commands.registerCommand`
3. If it needs a menu entry, add it to `contributes.menus` in `package.json`
4. Add the command ID to the `expectedCommands` array in `src/test/e2e/extension.test.ts`

### Updating minimum Okteto CLI version
- Change the `minVersion` constant in `src/extension.ts`
- Update `CHANGELOG.md`

### Updating dependencies
- `@types/vscode` version must match `engines.vscode` in `package.json` — `vsce package` will fail otherwise
- `@types/node` should stay on the major version matching the Node.js runtime (currently 22.x, matching CI's Node 22)
- After updating, run `npm test`, `npm run test:e2e`, and `npm run package` to verify

### Modifying manifest parsing
- Edit `src/manifest.ts`
- Supported formats: Okteto v2 manifests and Docker Compose files
- Tests in `src/test/suite/manifest.test.ts` with YAML fixtures in `artifacts/`
