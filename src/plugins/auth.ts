import { timingSafeEqual } from 'node:crypto';
import basicAuth from '@fastify/basic-auth';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import type { AppConfig } from '../config.js';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, Buffer.alloc(ab.length));
    return false;
  }
  return timingSafeEqual(ab, bb);
}

const authPlugin: FastifyPluginAsync<{ config: AppConfig }> = async (app, opts) => {
  await app.register(basicAuth, {
    validate: async (username, password) => {
      const userOk = safeEqual(username, opts.config.authUser);
      const passOk = safeEqual(password, opts.config.authPassword);
      if (!userOk || !passOk) {
        const err = new Error('Invalid credentials') as Error & { statusCode?: number };
        err.statusCode = 401;
        throw err;
      }
    },
    authenticate: { realm: 'sample-library' },
  });

  app.addHook('onRequest', app.basicAuth);
};

export default fp(authPlugin, { name: 'auth' });
