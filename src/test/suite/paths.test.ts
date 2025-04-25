'use strict';

import * as paths from '../../paths';
import { expect } from 'chai';
import { URI } from 'vscode-uri';

describe('toGitBash', () => {
  it('should return /c/users/user/code/', () => {
    const url = 'c:\\users\\user\\code.exe';
    const result = paths.toGitBash(url);
    expect(result).to.equal('/c/users/user/code.exe');
  });

  it('should return user/code', () => {
    const url = 'user\\code';
    const result = paths.toGitBash(url);
    expect(result).to.equal('user/code');
  });

  it('should return okteto', () => {
    const url = 'okteto';
    const result = paths.toGitBash(url);
    expect(result).to.equal('okteto');
  });

});

describe('sortFilePaths', () => {
  it('should sort correctly', () => {
    const uriArray: URI[] = [
      URI.parse('/var/www/html/index.html'),
      URI.parse('/home/user/documents/resume.pdf'),
      URI.parse('/etc/config.json'),
      URI.parse('/etc/hosts'),
      URI.parse('/usr/local/bin/node'),
      URI.parse('/home/user/downloads/image.jpg'),
      URI.parse('/a/b/c')
    ]

    const sortedOrder: URI[] = [
      URI.parse('/etc/config.json'),
      URI.parse('/etc/hosts'),
      URI.parse('/a/b/c'),
      URI.parse('/home/user/documents/resume.pdf'),
      URI.parse('/home/user/downloads/image.jpg'), 
      URI.parse('/usr/local/bin/node'),
      URI.parse('/var/www/html/index.html'),
      
    ]

    const result = paths.sortFilePaths(uriArray);
    for(let i = 0; i < sortedOrder.length; i = i+1){
      console.log(result[i].fsPath);
      expect(result[i].fsPath).to.equal(sortedOrder[i].fsPath);
    }
    
    
  });
});