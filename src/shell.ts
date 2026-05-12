'use strict';

/**
 * Identifies the quoting / escaping rules to use when building a shell command.
 * - `posix`     bash, zsh, sh, dash, fish, ksh, WSL, Git Bash, …
 * - `powershell` Windows PowerShell 5.1 and PowerShell 7+ (`pwsh`)
 * - `cmd`       Windows cmd.exe / Command Prompt
 */
export type ShellKind = 'posix' | 'powershell' | 'cmd';

/**
 * Detects which quoting style applies to the given shell binary.
 *
 * @param shellPath - The shell path reported by VS Code (`vscode.env.shell`), or any
 *   absolute / bare shell name. Both `\` and `/` separators are supported.
 * @param platform - The host platform; only used as a fallback when `shellPath` is
 *   missing or unrecognised.
 * @returns The quoting style to use when building command-line strings for that shell.
 */
export function detectShell(
    shellPath: string | undefined,
    platform: NodeJS.Platform = process.platform,
): ShellKind {
    if (shellPath) {
        const base = shellPath.replace(/\\/g, '/').split('/').pop()?.toLowerCase() ?? '';

        if (base === 'cmd.exe' || base === 'cmd') {
            return 'cmd';
        }

        if (base === 'powershell.exe' || base === 'powershell' || base === 'pwsh.exe' || base === 'pwsh') {
            return 'powershell';
        }

        // bash, zsh, sh, dash, fish, ksh, wsl.exe, etc.: all use POSIX-style quoting.
        return 'posix';
    }

    // No shell info available — pick a safe default per platform. On Windows the
    // modern default (Windows Terminal) is PowerShell, which is also strictly safer
    // than cmd as a fallback (PowerShell tolerates a wider value range).
    return platform === 'win32' ? 'powershell' : 'posix';
}

/**
 * Quotes a value for safe interpolation into a command line for the given shell.
 *
 * The function preserves the literal value of `value` — shell metacharacters
 * inside the quoted region are not expanded.
 *
 * @param value - The literal value to quote
 * @param shell - The shell whose quoting rules to use
 * @returns A quoted string safe to interpolate into a command line for `shell`
 */
export function quote(value: string, shell: ShellKind): string {
    switch (shell) {
        case 'posix':
            return quotePosix(value);
        case 'powershell':
            return quotePowerShell(value);
        case 'cmd':
            return quoteCmd(value);
    }
}

/**
 * POSIX shell quoting: wrap in `'…'`, escape embedded single quotes as `'\''`.
 */
export function quotePosix(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * PowerShell single-quoted string quoting: wrap in `'…'`, escape embedded
 * single quotes by doubling them (`''`). PowerShell does not expand any
 * variables or subexpressions inside single-quoted strings.
 */
export function quotePowerShell(value: string): string {
    return `'${value.replace(/'/g, `''`)}'`;
}

/**
 * cmd.exe / CommandLineToArgvW quoting: wrap in `"…"`, escape embedded
 * double quotes as `\"`, and double any run of backslashes that immediately
 * precedes a `"` (or the closing quote) so they are not consumed by the
 * argument parser.
 *
 * Reference: https://learn.microsoft.com/en-us/cpp/cpp/main-function-command-line-args#parsing-c-command-line-arguments
 */
export function quoteCmd(value: string): string {
    // Double each run of backslashes that comes immediately before a `"`,
    // and escape the `"` itself. Then double any trailing backslashes so
    // the closing `"` is not consumed.
    const escaped = value
        .replace(/(\\*)"/g, (_, slashes: string) => `${slashes}${slashes}\\"`)
        .replace(/(\\+)$/, (_, slashes: string) => `${slashes}${slashes}`);
    return `"${escaped}"`;
}

/**
 * Backwards-compatible alias for `quotePosix`. Prefer `quote(value, shell)`
 * with an explicit shell when adding new call sites.
 */
export const posixQuote = quotePosix;
