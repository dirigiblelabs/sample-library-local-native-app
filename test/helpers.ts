import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { loadConfig, type AppConfig } from '../src/config.js';
import type { BookStore } from '../src/services/bookStore.js';

export interface TestContext {
  app: FastifyInstance;
  store: BookStore;
  config: AppConfig;
  authHeader: string;
  base: string;
}

export async function startTestApp(overrides: Partial<AppConfig> = {}): Promise<TestContext> {
  const config: AppConfig = {
    ...loadConfig({
      PORT: '0',
      AUTH_USER: 'admin',
      AUTH_PASSWORD: 'admin',
      LOG_LEVEL: process.env['TEST_LOG'] ?? 'silent',
    }),
    ...overrides,
  };
  const { app, store } = await buildApp(config);
  await app.ready();
  const authHeader = `Basic ${Buffer.from(`${config.authUser}:${config.authPassword}`).toString('base64')}`;
  return {
    app,
    store,
    config,
    authHeader,
    base: config.apiBasePath,
  };
}
