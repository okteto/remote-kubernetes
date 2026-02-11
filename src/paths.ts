'use strict';

import * as path from 'path';
import {Uri} from 'vscode';

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