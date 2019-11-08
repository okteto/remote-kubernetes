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