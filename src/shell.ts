'use strict';

/**
 * Quotes a string for safe interpolation into a POSIX shell command line.
 * Wraps the value in single quotes and escapes any embedded single quotes.
 * Matches the quoting scheme already used elsewhere in the extension
 * (bash/zsh/Git Bash). Not safe for cmd.exe.
 *
 * @param value - The value to quote
 * @returns A single-quoted POSIX-shell-safe representation of the value
 */
export function posixQuote(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
}
