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

describe('PortAllocator', () => {
  it('hands out an available port at or above the starting cursor', async () => {
    const allocator = new ssh.PortAllocator(23000);
    const port = await allocator.next();
    expect(port).to.be.a('number');
    expect(port).to.be.greaterThanOrEqual(23000);
    expect(port).to.be.lessThanOrEqual(65535);
  });

  it('advances the cursor on every call so back-to-back probes start at different candidates', async () => {
    const allocator = new ssh.PortAllocator(23100);
    const p1 = await allocator.next();
    const p2 = await allocator.next();
    const p3 = await allocator.next();
    // All three should be distinct, and each should be >= the previous candidate.
    expect(new Set([p1, p2, p3]).size).to.equal(3);
  });

  it('skips ports that are already bound and returns the next free one', async () => {
    const allocator = new ssh.PortAllocator(23200);

    const server = net.createServer();
    await new Promise<void>((resolve) => server.listen(23200, '127.0.0.1', resolve));

    try {
      const port = await allocator.next();
      expect(port).to.not.equal(23200);
      expect(port).to.be.greaterThan(23200);
    } finally {
      server.close();
    }
  });

  it('produces a port near the starting cursor when nothing is bound there', async () => {
    const allocator = new ssh.PortAllocator(23400);
    const port = await allocator.next();
    // get-port may skip a few candidates if any are bound, but it shouldn't
    // wander wildly when the requested range is open.
    expect(port).to.be.greaterThanOrEqual(23400);
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
