import { afterEach, describe, expect, it } from 'vitest';
import { io as createClient, type Socket } from 'socket.io-client';
import { closeGateway, createGateway, type Gateway } from '../src/app.js';

describe('Socket.IO authentication stub', () => {
  let gateway: Gateway | undefined;
  let client: Socket | undefined;

  afterEach(async () => {
    client?.close();
    if (gateway) await closeGateway(gateway);
    client = undefined;
    gateway = undefined;
  });

  it('rejects a websocket handshake without a valid token', async () => {
    gateway = createGateway({ p0SocketToken: 'p0-test-token-that-is-not-a-real-jwt' });
    await gateway.app.listen({ host: '127.0.0.1', port: 0 });
    const address = gateway.app.server.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP address');

    client = createClient(`http://127.0.0.1:${address.port}`, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 2_000,
      auth: { protocolVersion: 1 }
    });

    const error = await new Promise<Error & { data?: { code?: string } }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('connect_error timeout')), 3_000);
      client?.once('connect_error', (connectError) => {
        clearTimeout(timeout);
        resolve(connectError);
      });
    });

    expect(error.message).toBe('unauthorized');
    expect(error.data?.code).toBe('UNAUTHORIZED');
    expect(client.connected).toBe(false);
  });
});
