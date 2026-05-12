import { expect } from 'chai';
import {
    detectShell,
    posixQuote,
    quote,
    quoteCmd,
    quotePosix,
    quotePowerShell,
} from '../../shell';

describe('detectShell', () => {
    describe('POSIX shells (Linux, macOS, WSL, Git Bash)', () => {
        const cases: Array<[string, string]> = [
            ['/bin/bash', 'Linux bash'],
            ['/bin/sh', 'POSIX sh'],
            ['/usr/bin/bash', 'Linux bash via /usr/bin'],
            ['/bin/zsh', 'macOS zsh'],
            ['/usr/local/bin/zsh', 'macOS Homebrew zsh'],
            ['/usr/local/bin/fish', 'fish shell'],
            ['/bin/dash', 'dash'],
            ['/usr/bin/ksh', 'ksh'],
            ['C:\\Program Files\\Git\\bin\\bash.exe', 'Git Bash on Windows'],
            ['C:\\Windows\\System32\\bash.exe', 'WSL "bash" alias'],
            ['C:\\Windows\\System32\\wsl.exe', 'WSL launcher'],
        ];

        for (const [shellPath, label] of cases) {
            it(`returns 'posix' for ${label} (${shellPath})`, () => {
                expect(detectShell(shellPath)).to.equal('posix');
            });
        }
    });

    describe('PowerShell', () => {
        const cases: Array<[string, string]> = [
            ['C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', 'Windows PowerShell 5.1'],
            ['C:\\Program Files\\PowerShell\\7\\pwsh.exe', 'PowerShell 7 (pwsh)'],
            ['/usr/local/bin/pwsh', 'PowerShell 7 on macOS/Linux'],
            ['pwsh', 'bare pwsh'],
            ['powershell.exe', 'bare powershell.exe'],
        ];

        for (const [shellPath, label] of cases) {
            it(`returns 'powershell' for ${label} (${shellPath})`, () => {
                expect(detectShell(shellPath)).to.equal('powershell');
            });
        }
    });

    describe('cmd.exe', () => {
        const cases: Array<[string, string]> = [
            ['C:\\Windows\\System32\\cmd.exe', 'cmd.exe absolute path'],
            ['cmd.exe', 'bare cmd.exe'],
            ['cmd', 'bare cmd'],
        ];

        for (const [shellPath, label] of cases) {
            it(`returns 'cmd' for ${label} (${shellPath})`, () => {
                expect(detectShell(shellPath)).to.equal('cmd');
            });
        }
    });

    describe('fallback when shellPath is missing', () => {
        it('defaults to powershell on win32', () => {
            expect(detectShell(undefined, 'win32')).to.equal('powershell');
        });

        it('defaults to posix on linux', () => {
            expect(detectShell(undefined, 'linux')).to.equal('posix');
        });

        it('defaults to posix on darwin', () => {
            expect(detectShell(undefined, 'darwin')).to.equal('posix');
        });
    });

    it('falls back to posix for an unrecognised shell name on linux', () => {
        // e.g. nushell, xonsh — treat as POSIX-ish since they all accept single-quoted literals
        expect(detectShell('/usr/local/bin/nu', 'linux')).to.equal('posix');
    });
});

describe('quote', () => {
    describe('posix', () => {
        it('wraps simple values in single quotes', () => {
            expect(quote('foo', 'posix')).to.equal(`'foo'`);
        });

        it('quotes values with spaces', () => {
            expect(quote('/Users/Bob/my project', 'posix')).to.equal(`'/Users/Bob/my project'`);
        });

        it('escapes embedded single quotes as \\\'\\\\\'\\\'', () => {
            expect(quote(`it's`, 'posix')).to.equal(`'it'\\''s'`);
        });

        it('escapes multiple embedded single quotes', () => {
            expect(quote(`a'b'c`, 'posix')).to.equal(`'a'\\''b'\\''c'`);
        });

        it('quotes an empty string', () => {
            expect(quote('', 'posix')).to.equal(`''`);
        });

        it('treats shell metacharacters as literal', () => {
            expect(quote('$(rm -rf /)', 'posix')).to.equal(`'$(rm -rf /)'`);
            expect(quote('a;b|c&d', 'posix')).to.equal(`'a;b|c&d'`);
            expect(quote('foo`bar`', 'posix')).to.equal(`'foo\`bar\`'`);
        });

        it('preserves backslashes (POSIX does not interpret them inside single quotes)', () => {
            expect(quote('C:\\Users\\Bob', 'posix')).to.equal(`'C:\\Users\\Bob'`);
        });
    });

    describe('powershell', () => {
        it('wraps simple values in single quotes', () => {
            expect(quote('foo', 'powershell')).to.equal(`'foo'`);
        });

        it('quotes values with spaces', () => {
            expect(quote('C:\\Program Files\\okteto', 'powershell')).to.equal(`'C:\\Program Files\\okteto'`);
        });

        it('escapes embedded single quotes by doubling them', () => {
            expect(quote(`it's`, 'powershell')).to.equal(`'it''s'`);
        });

        it('escapes multiple embedded single quotes', () => {
            expect(quote(`a'b'c`, 'powershell')).to.equal(`'a''b''c'`);
        });

        it('quotes an empty string', () => {
            expect(quote('', 'powershell')).to.equal(`''`);
        });

        it('treats $variable / subexpressions as literal (single quotes do not expand)', () => {
            expect(quote('$env:PATH', 'powershell')).to.equal(`'$env:PATH'`);
            expect(quote('$(Get-ChildItem)', 'powershell')).to.equal(`'$(Get-ChildItem)'`);
        });

        it('preserves backslashes (PowerShell does not escape inside single quotes)', () => {
            expect(quote('C:\\Users\\Bob\\okteto.yml', 'powershell')).to.equal(`'C:\\Users\\Bob\\okteto.yml'`);
        });
    });

    describe('cmd', () => {
        it('wraps simple values in double quotes', () => {
            expect(quote('foo', 'cmd')).to.equal(`"foo"`);
        });

        it('quotes values with spaces', () => {
            expect(quote('C:\\Program Files\\okteto\\okteto.exe', 'cmd')).to.equal(
                `"C:\\Program Files\\okteto\\okteto.exe"`,
            );
        });

        it('escapes embedded double quotes with backslash', () => {
            expect(quote('say "hi"', 'cmd')).to.equal(`"say \\"hi\\""`);
        });

        it('doubles trailing backslashes so the closing quote is not escaped', () => {
            expect(quote('C:\\foo\\', 'cmd')).to.equal(`"C:\\foo\\\\"`);
        });

        it('doubles a run of backslashes before an embedded quote', () => {
            expect(quote('a\\\\"b', 'cmd')).to.equal(`"a\\\\\\\\\\"b"`);
        });

        it('quotes an empty string', () => {
            expect(quote('', 'cmd')).to.equal(`""`);
        });

        it('treats cmd metacharacters as literal inside double quotes', () => {
            expect(quote('a&b|c<d>e', 'cmd')).to.equal(`"a&b|c<d>e"`);
        });

        it('leaves single quotes alone (they are literal in cmd anyway)', () => {
            expect(quote(`it's`, 'cmd')).to.equal(`"it's"`);
        });
    });
});

describe('quotePosix / quotePowerShell / quoteCmd (direct exports)', () => {
    it('quotePosix matches quote(value, "posix")', () => {
        expect(quotePosix(`it's a test`)).to.equal(quote(`it's a test`, 'posix'));
    });

    it('quotePowerShell matches quote(value, "powershell")', () => {
        expect(quotePowerShell(`it's a test`)).to.equal(quote(`it's a test`, 'powershell'));
    });

    it('quoteCmd matches quote(value, "cmd")', () => {
        expect(quoteCmd(`say "hi"`)).to.equal(quote(`say "hi"`, 'cmd'));
    });

    it('posixQuote is an alias for quotePosix (backwards compatibility)', () => {
        expect(posixQuote(`hello world`)).to.equal(quotePosix(`hello world`));
    });
});
