import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { callJson, startTestServer } from './helpers.js';

describe('Books REST API', () => {
  let ctx;

  before(async () => {
    ctx = await startTestServer();
  });

  after(async () => {
    await ctx.stop();
  });

  describe('authentication', () => {
    it('rejects missing Authorization header with 401 and WWW-Authenticate', async () => {
      const res = await callJson(`${ctx.baseUrl}/books`);
      assert.equal(res.status, 401);
      assert.match(res.headers.get('www-authenticate') ?? '', /^Basic realm=/);
      assert.equal(res.body.error.status, 401);
    });

    it('rejects invalid credentials with 401', async () => {
      const bad = `Basic ${Buffer.from('admin:wrong').toString('base64')}`;
      const res = await callJson(`${ctx.baseUrl}/books`, { authHeader: bad });
      assert.equal(res.status, 401);
    });

    it('accepts valid credentials', async () => {
      const res = await callJson(`${ctx.baseUrl}/books`, { authHeader: ctx.authHeader });
      assert.equal(res.status, 200);
    });
  });

  describe('CRUD lifecycle', () => {
    let createdId;
    let createdLocation;

    it('POST /books creates a book and returns 201 + Location', async () => {
      const res = await callJson(`${ctx.baseUrl}/books`, {
        method: 'POST',
        authHeader: ctx.authHeader,
        body: {
          title: 'The Pragmatic Programmer',
          author: 'Andy Hunt',
          isbn: '978-0135957059',
          publishedYear: 1999,
          genre: 'Software',
        },
      });
      assert.equal(res.status, 201);
      assert.ok(res.body.id);
      assert.equal(res.body.title, 'The Pragmatic Programmer');
      assert.equal(res.body.isbn, '9780135957059');
      assert.equal(res.body.available, true);
      assert.ok(res.body.createdAt);
      assert.ok(res.body.updatedAt);
      const location = res.headers.get('location');
      assert.ok(location, 'Location header set');
      assert.ok(location.endsWith(`/books/${res.body.id}`));
      createdId = res.body.id;
      createdLocation = location;
    });

    it('GET /books returns the new book in a paginated envelope', async () => {
      const res = await callJson(`${ctx.baseUrl}/books`, { authHeader: ctx.authHeader });
      assert.equal(res.status, 200);
      assert.equal(typeof res.body.total, 'number');
      assert.equal(res.body.offset, 0);
      assert.equal(res.body.limit, 50);
      assert.ok(res.body.items.some((b) => b.id === createdId));
    });

    it('GET /books/{id} returns the book', async () => {
      const res = await callJson(`${ctx.baseUrl}/books/${createdId}`, {
        authHeader: ctx.authHeader,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.id, createdId);
    });

    it('PATCH /books/{id} updates a subset of fields', async () => {
      const res = await callJson(`${ctx.baseUrl}/books/${createdId}`, {
        method: 'PATCH',
        authHeader: ctx.authHeader,
        body: { available: false },
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.available, false);
      assert.equal(res.body.title, 'The Pragmatic Programmer');
    });

    it('PUT /books/{id} replaces the resource', async () => {
      const res = await callJson(`${ctx.baseUrl}/books/${createdId}`, {
        method: 'PUT',
        authHeader: ctx.authHeader,
        body: {
          title: 'The Pragmatic Programmer, 20th Anniv. Ed.',
          author: 'David Thomas',
        },
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.title, 'The Pragmatic Programmer, 20th Anniv. Ed.');
      assert.equal(res.body.author, 'David Thomas');
      assert.equal(res.body.isbn, undefined);
      assert.equal(res.body.available, true);
    });

    it('DELETE /books/{id} returns 204 and the resource is gone', async () => {
      const del = await callJson(`${ctx.baseUrl}/books/${createdId}`, {
        method: 'DELETE',
        authHeader: ctx.authHeader,
      });
      assert.equal(del.status, 204);
      assert.equal(del.body, undefined);

      const get = await callJson(createdLocation.startsWith('http')
        ? createdLocation
        : `${ctx.baseUrl.replace(ctx.config.apiBasePath, '')}${createdLocation}`,
      { authHeader: ctx.authHeader });
      assert.equal(get.status, 404);
    });
  });

  describe('validation and error handling', () => {
    it('rejects body without required fields (400)', async () => {
      const res = await callJson(`${ctx.baseUrl}/books`, {
        method: 'POST',
        authHeader: ctx.authHeader,
        body: { title: 'Orphan' },
      });
      assert.equal(res.status, 400);
      assert.match(res.body.error.message, /author/);
    });

    it('rejects unknown fields (400)', async () => {
      const res = await callJson(`${ctx.baseUrl}/books`, {
        method: 'POST',
        authHeader: ctx.authHeader,
        body: { title: 'X', author: 'Y', mystery: 1 },
      });
      assert.equal(res.status, 400);
      assert.match(res.body.error.message, /mystery/);
    });

    it('rejects invalid ISBN (400)', async () => {
      const res = await callJson(`${ctx.baseUrl}/books`, {
        method: 'POST',
        authHeader: ctx.authHeader,
        body: { title: 'X', author: 'Y', isbn: 'nope' },
      });
      assert.equal(res.status, 400);
    });

    it('rejects duplicate ISBN with 409', async () => {
      const first = await callJson(`${ctx.baseUrl}/books`, {
        method: 'POST',
        authHeader: ctx.authHeader,
        body: { title: 'Dup A', author: 'A', isbn: '9780000000002' },
      });
      assert.equal(first.status, 201);
      const second = await callJson(`${ctx.baseUrl}/books`, {
        method: 'POST',
        authHeader: ctx.authHeader,
        body: { title: 'Dup B', author: 'B', isbn: '9780000000002' },
      });
      assert.equal(second.status, 409);
    });

    it('returns 404 for unknown id', async () => {
      const res = await callJson(
        `${ctx.baseUrl}/books/00000000-0000-0000-0000-000000000000`,
        { authHeader: ctx.authHeader },
      );
      assert.equal(res.status, 404);
    });

    it('returns 404 for malformed id', async () => {
      const res = await callJson(`${ctx.baseUrl}/books/not-a-uuid`, {
        authHeader: ctx.authHeader,
      });
      assert.equal(res.status, 404);
    });

    it('returns 405 for unsupported method on collection', async () => {
      const res = await callJson(`${ctx.baseUrl}/books`, {
        method: 'PUT',
        authHeader: ctx.authHeader,
        body: {},
      });
      assert.equal(res.status, 405);
    });

    it('returns 415 for non-JSON content-type with body', async () => {
      const res = await callJson(`${ctx.baseUrl}/books`, {
        method: 'POST',
        authHeader: ctx.authHeader,
        headers: { 'Content-Type': 'text/plain' },
        body: { title: 'X', author: 'Y' },
      });
      assert.equal(res.status, 415);
    });

    it('returns 400 for malformed JSON', async () => {
      const url = `${ctx.baseUrl}/books`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: ctx.authHeader,
          'Content-Type': 'application/json',
        },
        body: '{not json',
      });
      assert.equal(res.status, 400);
    });
  });

  describe('listing filters and pagination', () => {
    it('supports offset/limit and author filter', async () => {
      const isolated = await startTestServer();
      try {
        for (let i = 0; i < 5; i += 1) {
          await callJson(`${isolated.baseUrl}/books`, {
            method: 'POST',
            authHeader: isolated.authHeader,
            body: { title: `T${i}`, author: i % 2 === 0 ? 'Alice' : 'Bob' },
          });
        }
        const all = await callJson(`${isolated.baseUrl}/books?limit=2&offset=1`, {
          authHeader: isolated.authHeader,
        });
        assert.equal(all.status, 200);
        assert.equal(all.body.items.length, 2);
        assert.equal(all.body.total, 5);
        assert.equal(all.body.offset, 1);
        assert.equal(all.body.limit, 2);

        const filtered = await callJson(`${isolated.baseUrl}/books?author=alice`, {
          authHeader: isolated.authHeader,
        });
        assert.equal(filtered.body.total, 3);
        for (const b of filtered.body.items) assert.equal(b.author, 'Alice');
      } finally {
        await isolated.stop();
      }
    });
  });
});
