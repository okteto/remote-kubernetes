# CLAUDE.md - Instructions for Claude Code

## Project

VS Code extension for remote Kubernetes development with Okteto. See AGENT.md for full architecture details.

## Commands

```bash
npm run compile         # Dev build (esbuild)
npm test                # Unit tests (Mocha + Chai + Sinon, plain Node.js)
npm run test:e2e        # E2E tests (launches real VS Code via @vscode/test-electron)
npm run lint            # ESLint (typescript-eslint flat config)
npm run package         # Build .vsix (runs esbuild production build first)
npm run ci              # Full CI: install + lint + test + package
```

## Verification Checklist

After any code change, verify with:
1. `npm run lint` — no lint errors
2. `npm test` — unit tests pass
3. `npm run test:e2e` — e2e tests pass
4. `npm run package` — extension packages successfully

## Key Gotchas

- **`@types/vscode` must match `engines.vscode`**: If you bump `@types/vscode`, also bump `engines.vscode` in `package.json` to the same version. `vsce package` enforces this.
- **`@types/node` must match Node.js runtime**: CI uses Node 22. Keep `@types/node` on `^22.x`. Do not bump to 23+ unless CI is also updated.
- **E2E tests use `tsc`, not esbuild**: The `test:e2e` script compiles with `tsconfig.test.json` (which has `skipLibCheck: true`). This is required because `@vscode/test-electron` needs individual `.js` files.
- **E2E tests use TDD Mocha interface**: Use `suite`/`test` syntax in `src/test/e2e/`, not `describe`/`it`. The bootstrap (`src/test/e2e/index.ts`) is configured with `ui: 'tdd'`.
- **Unit tests use BDD Mocha interface**: Use `describe`/`it` syntax in `src/test/suite/`.
- **Unit tests mock `vscode`**: The mock at `src/test/mock/vscode.ts` is loaded via `-r` flag. It intercepts `require('vscode')` so modules with runtime `vscode` usage can be tested in plain Node.js.
- **ESLint v9, not v10**: `typescript-eslint` requires ESLint `^8.57 || ^9.0`. Do not upgrade to ESLint 10 until typescript-eslint supports it.
- **Squash merges only**: The repo disallows merge commits. Use `gh pr merge --squash`, not `--merge`.
- **Branch protection**: PRs require passing CI checks. Use `--admin` flag to bypass review requirements if needed.
- **Sentry CLI v3**: Source maps are uploaded with `sentry-cli sourcemaps upload`, not the old `sentry-cli releases files upload-sourcemaps`.

## Code Style

- TypeScript strict mode, semicolons always, `===` over `==`, curly braces required
- camelCase functions/variables, PascalCase classes
- async/await over raw Promises
- ESM imports compiled to CommonJS via esbuild
- Telemetry must respect `vscode.env.isTelemetryEnabled`

## When Adding Commands

1. `package.json` → `contributes.commands`
2. `src/extension.ts` → `vscode.commands.registerCommand`
3. `src/test/e2e/extension.test.ts` → add to `expectedCommands` array
