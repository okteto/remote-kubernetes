'use strict';

import { expect } from 'chai';
import * as download from '../../download';
import * as os from 'os';

describe('minimum version', () => {
  it('should be a valid semver string', () => {
    expect(download.minimum).to.match(/^\d+\.\d+\.\d+$/);
  });
});

describe('getInstallPath', () => {
  it('should return a path under homedir', () => {
    const result = download.getInstallPath();
    expect(result.startsWith(os.homedir())).to.equal(true);
  });

  it('should return platform-appropriate path', () => {
    const result = download.getInstallPath();
    if (os.platform() === 'win32') {
      expect(result).to.include('okteto.exe');
    } else {
      expect(result).to.include('.okteto-vscode');
      expect(result.endsWith('okteto')).to.equal(true);
    }
  });
});

describe('getOktetoDownloadInfo', () => {
  it('should return a valid download URL', () => {
    const info = download.getOktetoDownloadInfo();
    expect(info.url).to.include('https://downloads.okteto.com/cli/stable/');
    expect(info.url).to.include(download.minimum);
  });

  it('should set chmod based on platform', () => {
    const info = download.getOktetoDownloadInfo();
    if (os.platform() === 'win32') {
      expect(info.chmod).to.equal(false);
    } else {
      expect(info.chmod).to.equal(true);
    }
  });

  it('should return correct binary name for current platform', () => {
    const info = download.getOktetoDownloadInfo();
    const platform = os.platform();
    const arch = os.arch();

    if (platform === 'darwin') {
      if (arch === 'arm64') {
        expect(info.url).to.include('okteto-Darwin-arm64');
      } else {
        expect(info.url).to.include('okteto-Darwin-x86_64');
      }
    } else if (platform === 'win32') {
      expect(info.url).to.include('okteto.exe');
    } else {
      if (arch === 'arm64') {
        expect(info.url).to.include('okteto-Linux-arm64');
      } else {
        expect(info.url).to.include('okteto-Linux-x86_64');
      }
    }
  });
});
