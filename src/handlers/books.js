import { readJsonBody, sendJson, sendNoContent } from '../http.js';
import { badRequest } from '../errors.js';
import { validateCreate, validatePatch, validateReplace } from '../validation.js';

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

function parseListQuery(url) {
  const params = url.searchParams;
  const offsetRaw = params.get('offset');
  const limitRaw = params.get('limit');
  const availableRaw = params.get('available');

  const offset = offsetRaw === null ? 0 : Number(offsetRaw);
  const limit = limitRaw === null ? DEFAULT_LIMIT : Number(limitRaw);

  if (!Number.isInteger(offset) || offset < 0) {
    throw badRequest('Query parameter "offset" must be a non-negative integer');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw badRequest(`Query parameter "limit" must be an integer between 1 and ${MAX_LIMIT}`);
  }

  let available;
  if (availableRaw !== null) {
    if (availableRaw === 'true') available = true;
    else if (availableRaw === 'false') available = false;
    else throw badRequest('Query parameter "available" must be "true" or "false"');
  }

  return {
    offset,
    limit,
    author: params.get('author') ?? undefined,
    genre: params.get('genre') ?? undefined,
    available,
  };
}

function bookLocation(baseUrl, basePath, id) {
  return `${basePath}/books/${id}`;
}

export function createBooksHandlers({ store, config }) {
  return {
    async listBooks(req, res, { url }) {
      const query = parseListQuery(url);
      const result = store.list(query);
      sendJson(res, 200, result);
    },

    async createBook(req, res) {
      const body = await readJsonBody(req);
      const data = validateCreate(body);
      const book = store.create(data);
      sendJson(res, 201, book, {
        Location: bookLocation(undefined, config.apiBasePath, book.id),
      });
    },

    async getBook(req, res, { params }) {
      const book = store.get(params.id);
      sendJson(res, 200, book);
    },

    async replaceBook(req, res, { params }) {
      const body = await readJsonBody(req);
      const data = validateReplace(body);
      const book = store.replace(params.id, data);
      sendJson(res, 200, book);
    },

    async patchBook(req, res, { params }) {
      const body = await readJsonBody(req);
      const patch = validatePatch(body);
      const book = store.patch(params.id, patch);
      sendJson(res, 200, book);
    },

    async deleteBook(req, res, { params }) {
      store.remove(params.id);
      sendNoContent(res);
    },
  };
}
