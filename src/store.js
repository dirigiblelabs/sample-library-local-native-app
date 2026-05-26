import { randomUUID } from 'node:crypto';
import { conflict, notFound } from './errors.js';

export function createBookStore() {
  const books = new Map();
  const isbnIndex = new Map();

  function nowIso() {
    return new Date().toISOString();
  }

  function assertIsbnAvailable(isbn, excludeId) {
    if (!isbn) return;
    const existingId = isbnIndex.get(isbn);
    if (existingId && existingId !== excludeId) {
      throw conflict(`A book with ISBN ${isbn} already exists`, { isbn, id: existingId });
    }
  }

  function reindexIsbn(oldIsbn, newIsbn, id) {
    if (oldIsbn && oldIsbn !== newIsbn) isbnIndex.delete(oldIsbn);
    if (newIsbn) isbnIndex.set(newIsbn, id);
  }

  return {
    list({ offset = 0, limit = 50, author, genre, available } = {}) {
      let items = Array.from(books.values());
      if (author) {
        const needle = author.toLowerCase();
        items = items.filter((b) => b.author.toLowerCase().includes(needle));
      }
      if (genre) {
        const needle = genre.toLowerCase();
        items = items.filter((b) => (b.genre ?? '').toLowerCase() === needle);
      }
      if (available !== undefined) {
        items = items.filter((b) => b.available === available);
      }
      items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const total = items.length;
      const page = items.slice(offset, offset + limit);
      return { total, offset, limit, items: page };
    },

    get(id) {
      const book = books.get(id);
      if (!book) throw notFound(`Book ${id} not found`);
      return book;
    },

    create(data) {
      assertIsbnAvailable(data.isbn);
      const id = randomUUID();
      const ts = nowIso();
      const book = { id, ...data, createdAt: ts, updatedAt: ts };
      books.set(id, book);
      if (book.isbn) isbnIndex.set(book.isbn, id);
      return book;
    },

    replace(id, data) {
      const existing = books.get(id);
      if (!existing) throw notFound(`Book ${id} not found`);
      assertIsbnAvailable(data.isbn, id);
      const updated = {
        id,
        ...data,
        createdAt: existing.createdAt,
        updatedAt: nowIso(),
      };
      books.set(id, updated);
      reindexIsbn(existing.isbn, updated.isbn, id);
      return updated;
    },

    patch(id, patch) {
      const existing = books.get(id);
      if (!existing) throw notFound(`Book ${id} not found`);
      if ('isbn' in patch) assertIsbnAvailable(patch.isbn, id);
      const updated = { ...existing, ...patch, id, updatedAt: nowIso() };
      books.set(id, updated);
      if ('isbn' in patch) reindexIsbn(existing.isbn, updated.isbn, id);
      return updated;
    },

    remove(id) {
      const existing = books.get(id);
      if (!existing) throw notFound(`Book ${id} not found`);
      books.delete(id);
      if (existing.isbn) isbnIndex.delete(existing.isbn);
    },

    clear() {
      books.clear();
      isbnIndex.clear();
    },

    size() {
      return books.size;
    },
  };
}
