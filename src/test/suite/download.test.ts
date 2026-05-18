import { expect } from 'chai';
import * as download from '../../download';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import sinon from 'sinon';
import got from 'got';
import { Readable } from 'stream';
import vscode from 'vscode';

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

describe('getBinary', () => {
  const mock = (vscode as unknown as { __mock: { setConfiguration: (s: string, k: string, v: unknown) => void; reset: () => void } }).__mock;

  afterEach(() => mock.reset());

  it('returns the user-configured binary path when set', () => {
    mock.setConfiguration('okteto', 'binary', '/usr/local/bin/okteto');
    expect(download.getBinary()).to.equal('/usr/local/bin/okteto');
  });

  it('falls back to install path when binary setting is empty', () => {
    mock.setConfiguration('okteto', 'binary', '');
    expect(download.getBinary()).to.equal(download.getInstallPath());
  });

  it('falls back to install path when binary setting is whitespace', () => {
    mock.setConfiguration('okteto', 'binary', '   ');
    expect(download.getBinary()).to.equal(download.getInstallPath());
  });

  it('falls back to install path when binary setting is not configured', () => {
    expect(download.getBinary()).to.equal(download.getInstallPath());
  });
});

describe('binary', () => {
  let sandbox: sinon.SinonSandbox;
  let tmpFile: string;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    tmpFile = path.join(os.tmpdir(), `okteto-test-binary-${Date.now()}`);
  });

  afterEach(() => {
    sandbox.restore();
    try { fs.unlinkSync(tmpFile); } catch { /* already gone */ }
  });

  it('pipes download stream to disk and reports progress', async () => {
    const fakeReadable = new Readable({ read() {} });
    sandbox.stub(got, 'stream').returns(fakeReadable as ReturnType<typeof got.stream>);

    const reported: Array<{ increment: number; message: string }> = [];
    const fakeProgress: vscode.Progress<{ increment: number; message: string }> = { report: (v) => reported.push(v) };

    const payload = Buffer.from('hello world');
    setImmediate(() => {
      fakeReadable.emit('downloadProgress', { percent: 0.5 });
      fakeReadable.push(payload);
      fakeReadable.emit('downloadProgress', { percent: 1.0 });
      fakeReadable.push(null);
    });

    await download.binary('https://example.com/binary', tmpFile, fakeProgress);

    expect(reported).to.have.length(2);
    expect(reported[0]!.increment).to.equal(50);
    expect(reported[1]!.increment).to.equal(50);
    expect(fs.readFileSync(tmpFile).toString()).to.equal('hello world');
  });

  it('increments are cumulative — each event reports only the delta', async () => {
    const fakeReadable = new Readable({ read() {} });
    sandbox.stub(got, 'stream').returns(fakeReadable as ReturnType<typeof got.stream>);

    const reported: Array<{ increment: number }> = [];
    const fakeProgress: vscode.Progress<{ increment: number; message: string }> = { report: (v) => reported.push(v) };

    setImmediate(() => {
      fakeReadable.emit('downloadProgress', { percent: 0.25 });
      fakeReadable.emit('downloadProgress', { percent: 0.75 });
      fakeReadable.emit('downloadProgress', { percent: 1.0 });
      fakeReadable.push(null);
    });

    await download.binary('https://example.com/binary', tmpFile, fakeProgress);

    expect(reported[0]!.increment).to.equal(25);
    expect(reported[1]!.increment).to.equal(50);
    expect(reported[2]!.increment).to.equal(25);
  });

  it('rejects when the download stream errors', async () => {
    const fakeReadable = new Readable({ read() {} });
    sandbox.stub(got, 'stream').returns(fakeReadable as ReturnType<typeof got.stream>);

    const fakeProgress: vscode.Progress<{ increment: number; message: string }> = { report: () => {} };
    const boom = new Error('network failure');
    setImmediate(() => fakeReadable.destroy(boom));

    let caught: Error | undefined;
    try {
      await download.binary('https://example.com/binary', tmpFile, fakeProgress);
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).to.be.instanceOf(Error);
    expect(caught!.message).to.equal('network failure');
  });
});
