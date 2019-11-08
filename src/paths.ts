'use strict';

import * as path from 'path';

export function toGitBash(p: string): string {
  const split = p.split(path.win32.sep);
  console.log(split);
  const joined = path.posix.join(...split);
  let regex = /^([A-Za-z0-9]:).*/;
  
  const match = joined.match(regex);
  if (!match) {
    return joined;
  }

  const drive = match[1];
  const newDrive = '/' + drive[0];
  return newDrive + joined.slice(2); 
}
