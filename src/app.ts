import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import type { AppConfig } from './config.js';
import { HttpError } from './errors.js';
import authPlugin from './plugins/auth.js';
import booksRoutes from './routes/books.js';
import { BookStore } from './services/bookStore.js';

export interface BuiltApp {
  app: FastifyInstance;
  store: BookStore;
}

export async function buildApp(config: AppConfig): Promise<BuiltApp> {
  const app = Fastify({
    logger: { level: config.logLevel },
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler((err, req, reply) => {
    if (hasZodFastifySchemaValidationErrors(err)) {
      const details = err.validation.map((v) => ({
        path: v.instancePath || v.params?.issue?.path?.join('.') || '',
        message: v.message,
      }));
      return reply
        .code(400)
        .send({ error: { status: 400, message: 'Request validation failed', details } });
    }

    if (err instanceof HttpError) {
      const body: Record<string, unknown> = { status: err.status, message: err.message };
      if (err.details !== undefined) body['details'] = err.details;
      return reply.code(err.status).send({ error: body });
    }

    const fastifyErr = err as Partial<{
      statusCode: number;
      message: string;
      headers: Record<string, string>;
    }>;
    const status = fastifyErr.statusCode;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      if (status === 401) {
        const header = fastifyErr.headers?.['www-authenticate'];
        if (header) reply.header('WWW-Authenticate', header);
      }
      const message = fastifyErr.message ?? 'Request failed';
      return reply.code(status).send({ error: { status, message } });
    }

    req.log.error({ err }, 'Unhandled error');
    return reply.code(500).send({ error: { status: 500, message: 'Internal Server Error' } });
  });

  app.setNotFoundHandler((_req, reply) => {
    reply.code(404).send({ error: { status: 404, message: 'Resource not found' } });
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Sample Library API',
        description: 'In-memory library management REST API',
        version: '2.0.0',
      },
      servers: [{ url: `http://${config.host}:${config.port}` }],
      components: {
        securitySchemes: {
          basicAuth: { type: 'http', scheme: 'basic' },
        },
      },
      security: [{ basicAuth: [] }],
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
  });

  await app.register(authPlugin, { config });

  const store = new BookStore();
  await app.register(booksRoutes, { store, apiBasePath: config.apiBasePath });

  return { app, store };
}
