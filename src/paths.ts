import * as vscode from 'vscode';
import * as path from 'path';

var forcePosix: boolean | undefined;

function forcePosixPath(): boolean {
  if (forcePosix === undefined) {
    const config = vscode.workspace.getConfiguration('okteto');
    if (!config) {
      forcePosix = false;
    } else {
      forcePosix = config.get<boolean>('posixPath') || false;
    }
  }
  
  return forcePosix;
}

export function isAbsolute(p: string): boolean{
  if (forcePosixPath()) {
    return path.posix.isAbsolute(p);
  }

  return path.isAbsolute(p);
}

export function join(...paths: string[]): string{
  if (forcePosixPath()) {
    return path.posix.join(...paths);
  }

  return path.join(...paths);
}

export function dirname(p: string): string{
  if (forcePosixPath()) {
    return path.posix.dirname(p);
  }

  return path.dirname(p);
}