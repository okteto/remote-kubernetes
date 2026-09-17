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

// `getOktetoDownloadInfo` picks the binary purely from `os.platform()` and
// `os.arch()`. The tests above only ever exercise whichever platform the test
// runner happens to be on, so they cannot catch a regression in the other
// branches. These stub both calls to cover the full matrix.
//
// TypeScript's `__importStar` helper copies a module namespace behind
// non-configurable getters, so sinon cannot stub the imported `os` namespace
// directly. Those getters read through to the underlying module object, so we
// patch that and restore it after every test.
const osModule = require('os') as { platform: () => string; arch: () => string };

describe('getOktetoDownloadInfo platform matrix', () => {
  const realPlatform = osModule.platform;
  const realArch = osModule.arch;

  afterEach(() => {
    osModule.platform = realPlatform;
    osModule.arch = realArch;
  });

  const resolveAs = (platform: string, arch: string) => {
    osModule.platform = () => platform;
    osModule.arch = () => arch;
    return download.getOktetoDownloadInfo();
  };

  const cases = [
    // Windows ignores the architecture entirely, and is the only platform that
    // does not need the execute bit set.
    { platform: 'win32', arch: 'arm64', binary: 'okteto.exe', chmod: false },
    { platform: 'win32', arch: 'x64', binary: 'okteto.exe', chmod: false },
    { platform: 'win32', arch: 'ia32', binary: 'okteto.exe', chmod: false },

    // macOS splits on arm64 vs everything else.
    { platform: 'darwin', arch: 'arm64', binary: 'okteto-Darwin-arm64', chmod: true },
    { platform: 'darwin', arch: 'x64', binary: 'okteto-Darwin-x86_64', chmod: true },
    { platform: 'darwin', arch: 'ia32', binary: 'okteto-Darwin-x86_64', chmod: true },

    { platform: 'linux', arch: 'arm64', binary: 'okteto-Linux-arm64', chmod: true },
    { platform: 'linux', arch: 'x64', binary: 'okteto-Linux-x86_64', chmod: true },
    { platform: 'linux', arch: 'ia32', binary: 'okteto-Linux-x86_64', chmod: true },

    // Anything that is not win32 or darwin falls through to the Linux binaries.
    // That branch has no explicit `case`, so it is the one most likely to
    // regress unnoticed.
    { platform: 'freebsd', arch: 'arm64', binary: 'okteto-Linux-arm64', chmod: true },
    { platform: 'freebsd', arch: 'x64', binary: 'okteto-Linux-x86_64', chmod: true },
    { platform: 'aix', arch: 'x64', binary: 'okteto-Linux-x86_64', chmod: true },
    { platform: 'sunos', arch: 'x64', binary: 'okteto-Linux-x86_64', chmod: true },
    { platform: 'openbsd', arch: 'arm64', binary: 'okteto-Linux-arm64', chmod: true },
    { platform: 'android', arch: 'arm64', binary: 'okteto-Linux-arm64', chmod: true },
  ];

  cases.forEach(({ platform, arch, binary, chmod }) => {
    it(`resolves ${platform}/${arch} to ${binary}`, () => {
      const info = resolveAs(platform, arch);
      expect(info.url).to.equal(`https://downloads.okteto.com/cli/stable/${download.minimum}/${binary}`);
      expect(info.chmod).to.equal(chmod);
    });
  });

  it('always resolves a real binary name, never undefined', () => {
    const known = [
      'okteto.exe',
      'okteto-Darwin-arm64',
      'okteto-Darwin-x86_64',
      'okteto-Linux-arm64',
      'okteto-Linux-x86_64',
    ];
    const platforms = ['win32', 'darwin', 'linux', 'freebsd', 'aix', 'sunos', 'openbsd', 'android', 'cygwin', 'netbsd', 'haiku'];
    const arches = ['arm64', 'x64', 'ia32', 'arm', 'ppc64', 's390x', 'riscv64', 'loong64', 'mips'];

    let checked = 0;
    for (const platform of platforms) {
      for (const arch of arches) {
        const info = resolveAs(platform, arch);
        expect(info.url, `${platform}/${arch}`).to.not.include('undefined');
        expect(info.url.split('/').pop(), `${platform}/${arch}`).to.be.oneOf(known);
        checked++;
      }
    }
    expect(checked).to.equal(platforms.length * arches.length);
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
