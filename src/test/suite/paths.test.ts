'use strict';

import * as paths from '../../paths';
import { expect } from 'chai';

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

describe('isDefaultManifestPath', () => {
  it('should return true for okteto.yaml', () => {
    expect(paths.isDefaultManifestPath('/path/to/okteto.yaml')).equal(true);
    expect(paths.isDefaultManifestPath('okteto.yaml')).equal(true);
  });

  it('should return true for okteto.yml', () => {
    expect(paths.isDefaultManifestPath('/path/to/okteto.yml')).equal(true);
    expect(paths.isDefaultManifestPath('okteto.yml')).equal(true);
  });

  it('should return false for non-default manifest paths', () => {
    expect(paths.isDefaultManifestPath('/path/to/custom.yaml')).equal(false);
    expect(paths.isDefaultManifestPath('manifest.yml')).equal(false);
    expect(paths.isDefaultManifestPath('okteto.json')).equal(false);
    expect(paths.isDefaultManifestPath('')).equal(false);
  });

  it('should handle case sensitivity correctly', () => {
    expect(paths.isDefaultManifestPath('OKTETO.YAML')).equal(false);
    expect(paths.isDefaultManifestPath('Okteto.yml')).equal(false);
  });
});