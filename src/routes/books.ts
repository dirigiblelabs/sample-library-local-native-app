import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  BookCreateSchema,
  BookIdParamsSchema,
  BookListQuerySchema,
  BookListResponseSchema,
  BookPatchSchema,
  BookReplaceSchema,
  BookSchema,
} from '../schemas/book.js';
import type { BookStore } from '../services/bookStore.js';

interface BooksRoutesOptions {
  store: BookStore;
  apiBasePath: string;
}

const booksRoutes: FastifyPluginAsync<BooksRoutesOptions> = async (app, opts) => {
  const router = app.withTypeProvider<ZodTypeProvider>();
  const { store, apiBasePath } = opts;
  const collection = `${apiBasePath}/books`;
  const item = `${apiBasePath}/books/:id`;

  router.get(collection, {
    schema: {
      tags: ['books'],
      summary: 'List books',
      querystring: BookListQuerySchema,
      response: { 200: BookListResponseSchema },
    },
    handler: async (req) => store.list(req.query),
  });

  router.post(collection, {
    schema: {
      tags: ['books'],
      summary: 'Create a book',
      body: BookCreateSchema,
      response: { 201: BookSchema },
    },
    handler: async (req, reply) => {
      const book = store.create(req.body);
      reply.header('Location', `${apiBasePath}/books/${book.id}`);
      reply.code(201);
      return book;
    },
  });

  router.get(item, {
    schema: {
      tags: ['books'],
      summary: 'Fetch a book by id',
      params: BookIdParamsSchema,
      response: { 200: BookSchema },
    },
    handler: async (req) => store.get(req.params.id),
  });

  router.put(item, {
    schema: {
      tags: ['books'],
      summary: 'Replace a book',
      params: BookIdParamsSchema,
      body: BookReplaceSchema,
      response: { 200: BookSchema },
    },
    handler: async (req) => store.replace(req.params.id, req.body),
  });

  router.patch(item, {
    schema: {
      tags: ['books'],
      summary: 'Partially update a book',
      params: BookIdParamsSchema,
      body: BookPatchSchema,
      response: { 200: BookSchema },
    },
    handler: async (req) => store.patch(req.params.id, req.body),
  });

  router.delete(item, {
    schema: {
      tags: ['books'],
      summary: 'Delete a book',
      params: BookIdParamsSchema,
      response: { 204: z.null() },
    },
    handler: async (req, reply) => {
      store.remove(req.params.id);
      reply.code(204);
      return null;
    },
  });
};

export default booksRoutes;
