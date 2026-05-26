import { randomUUID } from 'node:crypto';
import { conflict, notFound } from '../errors.js';
import type {
  Book,
  BookCreate,
  BookListQuery,
  BookListResponse,
  BookPatch,
  BookReplace,
} from '../schemas/book.js';

export class BookStore {
  private readonly books = new Map<string, Book>();
  private readonly isbnIndex = new Map<string, string>();

  private nowIso(): string {
    return new Date().toISOString();
  }

  private assertIsbnAvailable(isbn: string | undefined, excludeId?: string): void {
    if (!isbn) return;
    const existing = this.isbnIndex.get(isbn);
    if (existing && existing !== excludeId) {
      throw conflict(`A book with ISBN ${isbn} already exists`, { isbn, id: existing });
    }
  }

  private reindexIsbn(oldIsbn: string | undefined, newIsbn: string | undefined, id: string): void {
    if (oldIsbn && oldIsbn !== newIsbn) this.isbnIndex.delete(oldIsbn);
    if (newIsbn) this.isbnIndex.set(newIsbn, id);
  }

  list(query: BookListQuery): BookListResponse {
    const { offset, limit, author, genre, available } = query;
    let items = Array.from(this.books.values());
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
  }

  get(id: string): Book {
    const book = this.books.get(id);
    if (!book) throw notFound(`Book ${id} not found`);
    return book;
  }

  create(data: BookCreate): Book {
    this.assertIsbnAvailable(data.isbn);
    const id = randomUUID();
    const ts = this.nowIso();
    const book: Book = { id, ...data, createdAt: ts, updatedAt: ts };
    this.books.set(id, book);
    if (book.isbn) this.isbnIndex.set(book.isbn, id);
    return book;
  }

  replace(id: string, data: BookReplace): Book {
    const existing = this.books.get(id);
    if (!existing) throw notFound(`Book ${id} not found`);
    this.assertIsbnAvailable(data.isbn, id);
    const updated: Book = {
      id,
      ...data,
      createdAt: existing.createdAt,
      updatedAt: this.nowIso(),
    };
    this.books.set(id, updated);
    this.reindexIsbn(existing.isbn, updated.isbn, id);
    return updated;
  }

  patch(id: string, patch: BookPatch): Book {
    const existing = this.books.get(id);
    if (!existing) throw notFound(`Book ${id} not found`);
    if ('isbn' in patch) this.assertIsbnAvailable(patch.isbn, id);
    const updated: Book = { ...existing, ...patch, id, updatedAt: this.nowIso() };
    this.books.set(id, updated);
    if ('isbn' in patch) this.reindexIsbn(existing.isbn, updated.isbn, id);
    return updated;
  }

  remove(id: string): void {
    const existing = this.books.get(id);
    if (!existing) throw notFound(`Book ${id} not found`);
    this.books.delete(id);
    if (existing.isbn) this.isbnIndex.delete(existing.isbn);
  }

  clear(): void {
    this.books.clear();
    this.isbnIndex.clear();
  }

  size(): number {
    return this.books.size;
  }
}
