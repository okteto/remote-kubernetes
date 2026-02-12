'use strict';

import * as path from 'path';
import {Uri} from 'vscode';

/**
 * Converts a Windows path to Git Bash compatible format.
 * Transforms Windows-style paths (e.g., "C:\users\user\code") to Unix-style paths compatible with Git Bash (e.g., "/c/users/user/code").
 * @param p - The path to convert
 * @returns The Git Bash compatible path
 */
export function toGitBash(p: string): string {
  const split = p.split(path.win32.sep);
  console.log(split);
  const joined = path.posix.join(...split);
  const regex = /^([A-Za-z0-9]:).*/;
  
  const match = joined.match(regex);
  if (!match) {
    return joined;
  }

  const drive = match[1];
  const newDrive = '/' + drive[0];
  return newDrive + joined.slice(2);
}

/**
 * Sorts file URIs by path for consistent ordering.
 * Sorts first by directory depth (fewer segments first), then alphabetically.
 * @param files - Array of VS Code URIs to sort
 * @returns Sorted array of URIs
 */
export function sortFilePaths(files: Uri[]) {
  files.sort((a, b) => {
  
    const aSegments = a.fsPath.split('/').filter(Boolean).length
    const bSegments = b.fsPath.split('/').filter(Boolean).length

    // If segment counts are different, sort by number of segments
    if (aSegments !== bSegments) {
        return aSegments - bSegments;
    }
    // If segmetn coutns are the same, sort alphabetically
    return a.fsPath.localeCompare(b.fsPath);        
  });

  return files;
}