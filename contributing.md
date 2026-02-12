# Contributing to Remote - Kubernetes

Interested in contributing? As an open source project, we'd appreciate any help and contributions!

We follow the standard [GitHub pull request process](https://help.github.com/articles/about-pull-requests/). We'll try to review your contributions as soon as possible.

## Development Setup

### Prerequisites
- [Node.js 22.x](https://nodejs.org/)
- [VS Code](https://code.visualstudio.com/)
- [Git](https://git-scm.com/)

### Getting Started

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/<your-username>/remote-kubernetes.git
   cd remote-kubernetes
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the extension**
   ```bash
   npm run compile
   ```

4. **Run tests**
   ```bash
   npm test              # Unit tests
   npm run test:e2e      # End-to-end tests
   ```

5. **Package the extension**
   ```bash
   npm run package       # Builds .vsix file
   ```

### Development Workflow

1. **Make your changes**
   - Edit source files in `src/`
   - Run `npm run compile` to rebuild

2. **Debug the extension**
   - Open the project in VS Code
   - Press `F5` to launch Extension Development Host
   - Test your changes in the new VS Code window

3. **Run tests**
   ```bash
   npm run lint          # Check code style
   npm test              # Run unit tests
   npm run test:e2e      # Run E2E tests
   npm run package       # Verify packaging works
   ```

4. **Submit a pull request**
   - Create a branch: `git checkout -b feature/my-feature`
   - Commit your changes with descriptive messages
   - Push to your fork: `git push origin feature/my-feature`
   - Open a pull request on GitHub

### Project Structure

```
remote-kubernetes/
├── src/
│   ├── extension.ts       # Main entry point, command registration
│   ├── okteto.ts          # Okteto CLI wrapper functions
│   ├── manifest.ts        # Manifest parsing and validation
│   ├── download.ts        # CLI download and installation
│   ├── logger.ts          # LogOutputChannel for structured logging
│   ├── telemetry.ts       # Sentry and Mixpanel integration
│   ├── ssh.ts             # SSH port management
│   └── test/
│       ├── suite/         # Unit tests (Mocha, BDD style)
│       └── e2e/           # End-to-end tests (TDD style)
├── dist/                  # Compiled extension (esbuild output)
├── package.json           # Extension manifest and scripts
├── esbuild.js             # Build configuration
└── tsconfig.json          # TypeScript configuration
```

### Key Commands

| Command | Description |
|---------|-------------|
| `npm run compile` | Build the extension (dev mode) |
| `npm run watch` | Build with file watching |
| `npm test` | Run unit tests |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run lint` | Check code style with ESLint |
| `npm run package` | Create .vsix package |

### Code Style

- **TypeScript strict mode** - All code uses strict type checking
- **Semicolons required** - Always use semicolons
- **Use `===` over `==`** - Strict equality only
- **Curly braces required** - Even for single-line blocks
- **camelCase** - Functions and variables
- **PascalCase** - Classes and interfaces
- **async/await** - Prefer over raw Promises

### Testing Guidelines

- **Unit tests** - Use `describe`/`it` (BDD style)
- **E2E tests** - Use `suite`/`test` (TDD style)
- **Coverage** - Add tests for new features
- **Verification** - Run all tests before submitting PR

### Important Notes

- `@types/vscode` version **must match** `engines.vscode` in package.json
- `@types/node` version **must stay on 22.x** (matches CI Node.js version)
- Use squash merges only (merge commits are disabled)
- ESLint must stay on v9 until typescript-eslint adds v10 support

## File an Issue

Not ready to contribute code, but see something that needs work? While we encourage everyone to contribute code, it is also appreciated when someone reports an issue. We use [GitHub issues](https://github.com/okteto/remote-kubernetes/issues) for this.

Also, check our [troubleshooting section](docs/troubleshooting.md) for known issues.

## Code of Conduct

Please make sure to read and observe our [code of conduct](code-of-conduct.md).
