import { methodNotAllowed, notFound } from './errors.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createRouter({ config, handlers }) {
  const base = config.apiBasePath;
  const booksCollection = `${base}/books`;
  const bookItemPrefix = `${booksCollection}/`;

  function resolve(method, pathname) {
    if (pathname === booksCollection) {
      switch (method) {
        case 'GET':
          return { handler: handlers.listBooks, params: {} };
        case 'POST':
          return { handler: handlers.createBook, params: {} };
        default:
          throw methodNotAllowed(`Method ${method} not allowed on ${pathname}`);
      }
    }

    if (pathname.startsWith(bookItemPrefix)) {
      const remainder = pathname.slice(bookItemPrefix.length);
      if (remainder.length === 0 || remainder.includes('/')) {
        throw notFound(`No route matches ${pathname}`);
      }
      if (!UUID_RE.test(remainder)) {
        throw notFound(`No route matches ${pathname}`);
      }
      const params = { id: remainder.toLowerCase() };
      switch (method) {
        case 'GET':
          return { handler: handlers.getBook, params };
        case 'PUT':
          return { handler: handlers.replaceBook, params };
        case 'PATCH':
          return { handler: handlers.patchBook, params };
        case 'DELETE':
          return { handler: handlers.deleteBook, params };
        default:
          throw methodNotAllowed(`Method ${method} not allowed on ${pathname}`);
      }
    }

    throw notFound(`No route matches ${pathname}`);
  }

  return { resolve };
}
