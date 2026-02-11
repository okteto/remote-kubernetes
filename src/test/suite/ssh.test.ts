'use strict';

import { expect } from 'chai';
import * as ssh from '../../ssh';
import * as net from 'net';

describe('getPort', () => {
  it('should return a valid port number', async () => {
    const port = await ssh.getPort();
    expect(port).to.be.a('number');
    expect(port).to.be.greaterThanOrEqual(1024);
    expect(port).to.be.lessThanOrEqual(65535);
  });

  it('should return different ports on subsequent calls', async () => {
    const port1 = await ssh.getPort();
    const port2 = await ssh.getPort();
    expect(port1).to.not.equal(port2);
  });
});

describe('isReady', () => {
  it('should resolve true when server is listening', async () => {
    const server = net.createServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as net.AddressInfo;

    try {
      const result = await ssh.isReady(addr.port);
      expect(result).to.equal(true);
    } finally {
      server.close();
    }
  });

  it('should reject when no server is listening', async () => {
    try {
      await ssh.isReady(19999);
      expect.fail('should have rejected');
    } catch (err) {
      expect(err).to.be.an('error');
    }
  });
});
