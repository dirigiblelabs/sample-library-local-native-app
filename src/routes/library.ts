import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { AppConfig } from '../config.js';
import { LibrarySchema } from '../schemas/library.js';

interface LibraryRoutesOptions {
  config: AppConfig;
  apiBasePath: string;
}

const libraryRoutes: FastifyPluginAsync<LibraryRoutesOptions> = async (app, opts) => {
  const router = app.withTypeProvider<ZodTypeProvider>();
  const { config, apiBasePath } = opts;

  router.get(`${apiBasePath}/library`, {
    schema: {
      tags: ['library'],
      summary: 'Fetch library info',
      response: { 200: LibrarySchema },
    },
    handler: async () => ({
      address: config.libraryAddress,
      phoneNumber: config.libraryPhone,
    }),
  });
};

export default libraryRoutes;
