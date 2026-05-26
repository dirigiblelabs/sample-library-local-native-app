import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestContext } from './helpers.js';

describe('Library REST API', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await startTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('requires basic auth', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: `${ctx.base}/library` });
    expect(res.statusCode).toBe(401);
  });

  it('GET /library returns the schema-default address and phone when env is unset', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: `${ctx.base}/library`,
      headers: { authorization: ctx.authHeader },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toEqual({
      address: '123 Library Lane, Booktown',
      phoneNumber: '+1-555-0100',
    });
  });

  it('GET /library reflects values overridden via config', async () => {
    const isolated = await startTestApp({
      libraryAddress: '999 Test Ave',
      libraryPhone: '+1-555-9999',
    });
    try {
      const res = await isolated.app.inject({
        method: 'GET',
        url: `${isolated.base}/library`,
        headers: { authorization: isolated.authHeader },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        address: '999 Test Ave',
        phoneNumber: '+1-555-9999',
      });
    } finally {
      await isolated.app.close();
    }
  });

  it('is described in the OpenAPI document', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/docs/json',
      headers: { authorization: ctx.authHeader },
    });
    expect(res.statusCode).toBe(200);
    const spec = res.json();
    const path = spec.paths[`${ctx.base}/library`];
    expect(path).toBeDefined();
    expect(path.get).toBeDefined();
  });
});
