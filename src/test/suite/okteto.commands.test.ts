import { expect } from 'chai';
import {
    buildDownArgs,
    buildDeployCommand,
    buildDestroyCommand,
    buildSetContextCommand,
    buildSetNamespaceCommand,
    buildTestCommand,
    buildUpCommand,
} from '../../okteto';
import { ShellKind } from '../../shell';

/**
 * These tests cover every shell environment our customers actually use:
 *
 *   Linux / macOS      → bash or zsh             → posix
 *   Windows + WSL      → wsl.exe + bash inside   → posix
 *   Windows + Git Bash → Git\bin\bash.exe        → posix
 *   Windows + WT       → PowerShell 7 (pwsh.exe) → powershell
 *   Windows + cmd      → cmd.exe                 → cmd
 *
 * For each command we exercise the typical "happy path" (clean identifiers,
 * Unix-style paths) and the values that historically broke each shell:
 *   - spaces in paths       (cmd, PowerShell)
 *   - apostrophes / quotes  (POSIX, PowerShell)
 *   - shell metacharacters  (all shells)
 */

const linuxBinary = '/home/user/.okteto-vscode/okteto';
const macBinary = '/Users/Bob/.okteto-vscode/okteto';
const gitBashBinary = '/c/Users/Bob/AppData/Local/Programs/okteto.exe';
const cmdBinary = 'C:\\Users\\Bob\\AppData\\Local\\Programs\\okteto.exe';
const psBinary = 'C:\\Program Files\\okteto\\okteto.exe';

describe('buildUpCommand', () => {
    it('Linux + bash (posix): builds a properly quoted up command', () => {
        const cmd = buildUpCommand({
            binary: linuxBinary,
            name: 'api',
            manifest: '/home/user/code/okteto.yml',
            port: 22100,
            shell: 'posix',
        });
        expect(cmd).to.equal(
            `'/home/user/.okteto-vscode/okteto' up 'api' -f '/home/user/code/okteto.yml' --remote 22100`,
        );
    });

    it('macOS + zsh (posix): handles spaces in the manifest path', () => {
        const cmd = buildUpCommand({
            binary: macBinary,
            name: 'web',
            manifest: '/Users/Bob/My Projects/Okteto Demo/okteto.yml',
            port: 22101,
            shell: 'posix',
        });
        expect(cmd).to.equal(
            `'/Users/Bob/.okteto-vscode/okteto' up 'web' -f '/Users/Bob/My Projects/Okteto Demo/okteto.yml' --remote 22101`,
        );
    });

    it('macOS + zsh (posix): escapes an apostrophe in a service name', () => {
        const cmd = buildUpCommand({
            binary: macBinary,
            name: "o'reilly",
            manifest: '/Users/Bob/okteto.yml',
            port: 22102,
            shell: 'posix',
        });
        // posix: ' inside a single-quoted region is closed, escaped, reopened
        expect(cmd).to.equal(
            `'/Users/Bob/.okteto-vscode/okteto' up 'o'\\''reilly' -f '/Users/Bob/okteto.yml' --remote 22102`,
        );
    });

    it('Windows + WSL (posix): paths are POSIX style after conversion', () => {
        const cmd = buildUpCommand({
            binary: '/usr/local/bin/okteto',
            name: 'api',
            manifest: '/mnt/c/Users/Bob/okteto.yml',
            port: 22103,
            shell: 'posix',
        });
        expect(cmd).to.equal(
            `'/usr/local/bin/okteto' up 'api' -f '/mnt/c/Users/Bob/okteto.yml' --remote 22103`,
        );
    });

    it('Windows + Git Bash (posix): handles /c/... style paths from paths.toGitBash', () => {
        const cmd = buildUpCommand({
            binary: gitBashBinary,
            name: 'api',
            manifest: '/c/Users/Bob/My Code/okteto.yml',
            port: 22104,
            shell: 'posix',
        });
        expect(cmd).to.equal(
            `'/c/Users/Bob/AppData/Local/Programs/okteto.exe' up 'api' -f '/c/Users/Bob/My Code/okteto.yml' --remote 22104`,
        );
    });

    it('Windows + PowerShell: wraps Windows paths in single quotes, preserves backslashes', () => {
        const cmd = buildUpCommand({
            binary: psBinary,
            name: 'api',
            manifest: 'C:\\Users\\Bob\\My Code\\okteto.yml',
            port: 22105,
            shell: 'powershell',
        });
        expect(cmd).to.equal(
            `'C:\\Program Files\\okteto\\okteto.exe' up 'api' -f 'C:\\Users\\Bob\\My Code\\okteto.yml' --remote 22105`,
        );
    });

    it('Windows + PowerShell: doubles a single quote in a service name', () => {
        const cmd = buildUpCommand({
            binary: psBinary,
            name: "o'reilly",
            manifest: 'C:\\okteto.yml',
            port: 22106,
            shell: 'powershell',
        });
        expect(cmd).to.equal(
            `'C:\\Program Files\\okteto\\okteto.exe' up 'o''reilly' -f 'C:\\okteto.yml' --remote 22106`,
        );
    });

    it('Windows + cmd.exe: wraps in double quotes, escapes embedded double quotes', () => {
        const cmd = buildUpCommand({
            binary: cmdBinary,
            name: 'api',
            manifest: 'C:\\Users\\Bob\\My Code\\okteto.yml',
            port: 22107,
            shell: 'cmd',
        });
        expect(cmd).to.equal(
            `"C:\\Users\\Bob\\AppData\\Local\\Programs\\okteto.exe" up "api" -f "C:\\Users\\Bob\\My Code\\okteto.yml" --remote 22107`,
        );
    });

    it('Windows + cmd.exe: doubles a trailing backslash so the closing quote is preserved', () => {
        const cmd = buildUpCommand({
            binary: cmdBinary,
            name: 'api',
            manifest: 'C:\\Users\\Bob\\',
            port: 22108,
            shell: 'cmd',
        });
        // Trailing \ must be doubled so the closing " is not consumed
        expect(cmd).to.include(`-f "C:\\Users\\Bob\\\\" --remote 22108`);
    });

    it('passes extra args through unmodified, after the quoted args', () => {
        const cmd = buildUpCommand({
            binary: linuxBinary,
            name: 'api',
            manifest: '/home/user/okteto.yml',
            port: 22100,
            extraArgs: '--log-level=warn --build',
            shell: 'posix',
        });
        expect(cmd).to.equal(
            `'/home/user/.okteto-vscode/okteto' up 'api' -f '/home/user/okteto.yml' --remote 22100 --log-level=warn --build`,
        );
    });

    it('omits the extra-args suffix when none are supplied', () => {
        const cmd = buildUpCommand({
            binary: linuxBinary,
            name: 'api',
            manifest: '/home/user/okteto.yml',
            port: 22100,
            extraArgs: '',
            shell: 'posix',
        });
        expect(cmd).to.equal(
            `'/home/user/.okteto-vscode/okteto' up 'api' -f '/home/user/okteto.yml' --remote 22100`,
        );
    });

    it('does not let a shell metacharacter in the service name escape quoting', () => {
        // Regression: an attacker-controlled or accidentally-named service must
        // not be able to break out of quoting on any shell.
        const malicious = `; rm -rf /`;
        for (const shell of ['posix', 'powershell', 'cmd'] as ShellKind[]) {
            const cmd = buildUpCommand({
                binary: linuxBinary,
                name: malicious,
                manifest: '/home/user/okteto.yml',
                port: 22100,
                shell,
            });
            // The metacharacters must appear inside the same quoted region as the value.
            expect(cmd).to.match(/up [`'"]; rm -rf \/[`'"]/);
        }
    });
});

describe('buildDeployCommand', () => {
    it('posix: quotes binary and manifest path', () => {
        const cmd = buildDeployCommand({
            binary: linuxBinary,
            manifestPath: '/home/user/okteto.yml',
            shell: 'posix',
        });
        expect(cmd).to.equal(`'/home/user/.okteto-vscode/okteto' deploy -f '/home/user/okteto.yml' --wait`);
    });

    it('powershell: handles Windows paths with spaces', () => {
        const cmd = buildDeployCommand({
            binary: psBinary,
            manifestPath: 'C:\\My Projects\\app\\okteto.yml',
            shell: 'powershell',
        });
        expect(cmd).to.equal(`'C:\\Program Files\\okteto\\okteto.exe' deploy -f 'C:\\My Projects\\app\\okteto.yml' --wait`);
    });

    it('cmd: handles Windows paths with spaces', () => {
        const cmd = buildDeployCommand({
            binary: cmdBinary,
            manifestPath: 'C:\\My Projects\\app\\okteto.yml',
            shell: 'cmd',
        });
        expect(cmd).to.equal(`"C:\\Users\\Bob\\AppData\\Local\\Programs\\okteto.exe" deploy -f "C:\\My Projects\\app\\okteto.yml" --wait`);
    });
});

describe('buildDownArgs', () => {
    it('builds args for a single service', () => {
        expect(buildDownArgs({
            target: {type: 'service', name: 'api'},
            manifestPath: '/home/user/okteto.yml',
            namespace: 'dev',
        })).to.deep.equal(['down', 'api', '--file', '/home/user/okteto.yml', '--namespace', 'dev']);
    });

    it('builds args for all services', () => {
        expect(buildDownArgs({
            target: {type: 'all'},
            manifestPath: '/home/user/okteto.yml',
            namespace: 'dev',
        })).to.deep.equal(['down', '--all', '--file', '/home/user/okteto.yml', '--namespace', 'dev']);
    });
});

describe('buildDestroyCommand', () => {
    it('posix', () => {
        expect(buildDestroyCommand({
            binary: linuxBinary,
            manifestPath: '/home/user/okteto.yml',
            shell: 'posix',
        })).to.equal(`'/home/user/.okteto-vscode/okteto' destroy -f '/home/user/okteto.yml'`);
    });

    it('powershell with spaces', () => {
        expect(buildDestroyCommand({
            binary: psBinary,
            manifestPath: 'C:\\My Projects\\okteto.yml',
            shell: 'powershell',
        })).to.equal(`'C:\\Program Files\\okteto\\okteto.exe' destroy -f 'C:\\My Projects\\okteto.yml'`);
    });

    it('cmd with spaces', () => {
        expect(buildDestroyCommand({
            binary: cmdBinary,
            manifestPath: 'C:\\My Projects\\okteto.yml',
            shell: 'cmd',
        })).to.equal(`"C:\\Users\\Bob\\AppData\\Local\\Programs\\okteto.exe" destroy -f "C:\\My Projects\\okteto.yml"`);
    });
});

describe('buildTestCommand', () => {
    it('posix: appends the test name when provided', () => {
        const cmd = buildTestCommand({
            binary: linuxBinary,
            manifestPath: '/home/user/okteto.yml',
            test: 'unit',
            shell: 'posix',
        });
        expect(cmd).to.equal(`'/home/user/.okteto-vscode/okteto' test -f '/home/user/okteto.yml' 'unit'`);
    });

    it('posix: omits the test arg when empty (run all tests)', () => {
        const cmd = buildTestCommand({
            binary: linuxBinary,
            manifestPath: '/home/user/okteto.yml',
            test: '',
            shell: 'posix',
        });
        expect(cmd).to.equal(`'/home/user/.okteto-vscode/okteto' test -f '/home/user/okteto.yml'`);
    });

    it('powershell: handles a test name with a hyphen', () => {
        const cmd = buildTestCommand({
            binary: psBinary,
            manifestPath: 'C:\\okteto.yml',
            test: 'integration-tests',
            shell: 'powershell',
        });
        expect(cmd).to.equal(`'C:\\Program Files\\okteto\\okteto.exe' test -f 'C:\\okteto.yml' 'integration-tests'`);
    });

    it('cmd: handles a test name with spaces', () => {
        const cmd = buildTestCommand({
            binary: cmdBinary,
            manifestPath: 'C:\\okteto.yml',
            test: 'my custom test',
            shell: 'cmd',
        });
        expect(cmd).to.equal(`"C:\\Users\\Bob\\AppData\\Local\\Programs\\okteto.exe" test -f "C:\\okteto.yml" "my custom test"`);
    });
});

describe('buildSetContextCommand', () => {
    it('posix: quotes a URL context', () => {
        const cmd = buildSetContextCommand({
            binary: linuxBinary,
            context: 'https://okteto.example.com',
            shell: 'posix',
        });
        expect(cmd).to.equal(`'/home/user/.okteto-vscode/okteto' context use 'https://okteto.example.com'`);
    });

    it('powershell: handles a context with a hyphen', () => {
        const cmd = buildSetContextCommand({
            binary: psBinary,
            context: 'my-kube-context',
            shell: 'powershell',
        });
        expect(cmd).to.equal(`'C:\\Program Files\\okteto\\okteto.exe' context use 'my-kube-context'`);
    });

    it('cmd: handles a Kubernetes context name with spaces', () => {
        const cmd = buildSetContextCommand({
            binary: cmdBinary,
            context: 'my cluster (prod)',
            shell: 'cmd',
        });
        expect(cmd).to.equal(`"C:\\Users\\Bob\\AppData\\Local\\Programs\\okteto.exe" context use "my cluster (prod)"`);
    });
});

describe('buildSetNamespaceCommand', () => {
    it('posix', () => {
        expect(buildSetNamespaceCommand({
            binary: linuxBinary,
            namespace: 'dev',
            shell: 'posix',
        })).to.equal(`'/home/user/.okteto-vscode/okteto' namespace use 'dev'`);
    });

    it('powershell with hyphen', () => {
        expect(buildSetNamespaceCommand({
            binary: psBinary,
            namespace: 'team-platform',
            shell: 'powershell',
        })).to.equal(`'C:\\Program Files\\okteto\\okteto.exe' namespace use 'team-platform'`);
    });

    it('cmd', () => {
        expect(buildSetNamespaceCommand({
            binary: cmdBinary,
            namespace: 'staging',
            shell: 'cmd',
        })).to.equal(`"C:\\Users\\Bob\\AppData\\Local\\Programs\\okteto.exe" namespace use "staging"`);
    });
});
