import { afterEach, describe, expect, it } from 'vitest';
import { closeGateway, createGateway, type Gateway } from '../src/app.js';

describe('GET /v1/health', () => {
  let gateway: Gateway | undefined;

  afterEach(async () => {
    if (gateway) await closeGateway(gateway);
    gateway = undefined;
  });

  it('returns a minimal readiness response', async () => {
    gateway = createGateway();
    const response = await gateway.app.inject({ method: 'GET', url: '/v1/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ready' });
  });
});
