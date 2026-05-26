import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestContext } from './helpers.js';

describe('Books REST API', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await startTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('authentication', () => {
    it('rejects missing Authorization with 401 + WWW-Authenticate', async () => {
      const res = await ctx.app.inject({ method: 'GET', url: `${ctx.base}/books` });
      expect(res.statusCode).toBe(401);
      expect(res.headers['www-authenticate']).toMatch(/^Basic/);
      expect(res.json().error.status).toBe(401);
    });

    it('rejects invalid credentials with 401', async () => {
      const bad = `Basic ${Buffer.from('admin:wrong').toString('base64')}`;
      const res = await ctx.app.inject({
        method: 'GET',
        url: `${ctx.base}/books`,
        headers: { authorization: bad },
      });
      expect(res.statusCode).toBe(401);
    });

    it('accepts valid credentials', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: `${ctx.base}/books`,
        headers: { authorization: ctx.authHeader },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('CRUD lifecycle', () => {
    let createdId: string;

    it('POST /books creates a book and returns 201 + Location', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: `${ctx.base}/books`,
        headers: { authorization: ctx.authHeader, 'content-type': 'application/json' },
        payload: {
          title: 'The Pragmatic Programmer',
          author: 'Andy Hunt',
          isbn: '978-0135957059',
          publishedYear: 1999,
          genre: 'Software',
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.title).toBe('The Pragmatic Programmer');
      expect(body.isbn).toBe('9780135957059');
      expect(body.available).toBe(true);
      expect(res.headers['location']).toBe(`${ctx.base}/books/${body.id}`);
      createdId = body.id;
    });

    it('GET /books returns paginated envelope including new book', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: `${ctx.base}/books`,
        headers: { authorization: ctx.authHeader },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.offset).toBe(0);
      expect(body.limit).toBe(50);
      expect(body.items.some((b: { id: string }) => b.id === createdId)).toBe(true);
    });

    it('GET /books/{id} returns the book', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: `${ctx.base}/books/${createdId}`,
        headers: { authorization: ctx.authHeader },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().id).toBe(createdId);
    });

    it('PATCH /books/{id} updates a subset of fields', async () => {
      const res = await ctx.app.inject({
        method: 'PATCH',
        url: `${ctx.base}/books/${createdId}`,
        headers: { authorization: ctx.authHeader, 'content-type': 'application/json' },
        payload: { available: false },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.available).toBe(false);
      expect(body.title).toBe('The Pragmatic Programmer');
    });

    it('PUT /books/{id} replaces the resource', async () => {
      const res = await ctx.app.inject({
        method: 'PUT',
        url: `${ctx.base}/books/${createdId}`,
        headers: { authorization: ctx.authHeader, 'content-type': 'application/json' },
        payload: {
          title: 'The Pragmatic Programmer, 20th Anniv. Ed.',
          author: 'David Thomas',
        },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.title).toBe('The Pragmatic Programmer, 20th Anniv. Ed.');
      expect(body.author).toBe('David Thomas');
      expect(body.isbn).toBeUndefined();
      expect(body.available).toBe(true);
    });

    it('DELETE /books/{id} returns 204 and resource is gone', async () => {
      const del = await ctx.app.inject({
        method: 'DELETE',
        url: `${ctx.base}/books/${createdId}`,
        headers: { authorization: ctx.authHeader },
      });
      expect(del.statusCode).toBe(204);
      expect(del.body).toBe('');

      const get = await ctx.app.inject({
        method: 'GET',
        url: `${ctx.base}/books/${createdId}`,
        headers: { authorization: ctx.authHeader },
      });
      expect(get.statusCode).toBe(404);
    });
  });

  describe('validation and errors', () => {
    it('rejects body without required fields (400)', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: `${ctx.base}/books`,
        headers: { authorization: ctx.authHeader, 'content-type': 'application/json' },
        payload: { title: 'Orphan' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects unknown fields (400)', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: `${ctx.base}/books`,
        headers: { authorization: ctx.authHeader, 'content-type': 'application/json' },
        payload: { title: 'X', author: 'Y', mystery: 1 },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects invalid ISBN (400)', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: `${ctx.base}/books`,
        headers: { authorization: ctx.authHeader, 'content-type': 'application/json' },
        payload: { title: 'X', author: 'Y', isbn: 'nope' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects duplicate ISBN with 409', async () => {
      const first = await ctx.app.inject({
        method: 'POST',
        url: `${ctx.base}/books`,
        headers: { authorization: ctx.authHeader, 'content-type': 'application/json' },
        payload: { title: 'Dup A', author: 'A', isbn: '9780000000002' },
      });
      expect(first.statusCode).toBe(201);
      const second = await ctx.app.inject({
        method: 'POST',
        url: `${ctx.base}/books`,
        headers: { authorization: ctx.authHeader, 'content-type': 'application/json' },
        payload: { title: 'Dup B', author: 'B', isbn: '9780000000002' },
      });
      expect(second.statusCode).toBe(409);
    });

    it('returns 404 for unknown id', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: `${ctx.base}/books/00000000-0000-0000-0000-000000000000`,
        headers: { authorization: ctx.authHeader },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 400 for malformed id (not a uuid)', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: `${ctx.base}/books/not-a-uuid`,
        headers: { authorization: ctx.authHeader },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 404 for unmatched route', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: `${ctx.base}/unknown`,
        headers: { authorization: ctx.authHeader },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 400 for malformed JSON', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: `${ctx.base}/books`,
        headers: { authorization: ctx.authHeader, 'content-type': 'application/json' },
        payload: '{not json',
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('listing filters and pagination', () => {
    it('supports offset/limit and author filter on an isolated app', async () => {
      const isolated = await startTestApp();
      try {
        for (let i = 0; i < 5; i += 1) {
          await isolated.app.inject({
            method: 'POST',
            url: `${isolated.base}/books`,
            headers: {
              authorization: isolated.authHeader,
              'content-type': 'application/json',
            },
            payload: { title: `T${i}`, author: i % 2 === 0 ? 'Alice' : 'Bob' },
          });
        }
        const paged = await isolated.app.inject({
          method: 'GET',
          url: `${isolated.base}/books?limit=2&offset=1`,
          headers: { authorization: isolated.authHeader },
        });
        expect(paged.statusCode).toBe(200);
        const pagedBody = paged.json();
        expect(pagedBody.items).toHaveLength(2);
        expect(pagedBody.total).toBe(5);
        expect(pagedBody.offset).toBe(1);
        expect(pagedBody.limit).toBe(2);

        const filtered = await isolated.app.inject({
          method: 'GET',
          url: `${isolated.base}/books?author=alice`,
          headers: { authorization: isolated.authHeader },
        });
        const filteredBody = filtered.json();
        expect(filteredBody.total).toBe(3);
        for (const b of filteredBody.items) expect(b.author).toBe('Alice');
      } finally {
        await isolated.app.close();
      }
    });
  });

  describe('OpenAPI docs', () => {
    it('serves /docs UI behind basic auth', async () => {
      const unauth = await ctx.app.inject({ method: 'GET', url: '/docs/' });
      expect(unauth.statusCode).toBe(401);

      const ok = await ctx.app.inject({
        method: 'GET',
        url: '/docs/json',
        headers: { authorization: ctx.authHeader },
      });
      expect(ok.statusCode).toBe(200);
      const spec = ok.json();
      expect(spec.openapi).toBeDefined();
      expect(spec.paths[`${ctx.base}/books`]).toBeDefined();
    });
  });
});
