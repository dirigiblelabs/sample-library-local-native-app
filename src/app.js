import { createServer } from 'node:http';
import { authChallengeHeaders, authenticate } from './auth.js';
import { HttpError } from './errors.js';
import { sendError } from './http.js';
import { createBooksHandlers } from './handlers/books.js';
import { createRouter } from './router.js';
import { createBookStore } from './store.js';

function buildUrl(req) {
  const host = req.headers.host ?? 'localhost';
  return new URL(req.url, `http://${host}`);
}

function logRequest(req, res, startNs) {
  const durationMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
  const remote = req.socket?.remoteAddress ?? '-';
  // eslint-disable-next-line no-console
  console.log(
    `${new Date().toISOString()} ${remote} ${req.method} ${req.url} -> ${res.statusCode} ${durationMs.toFixed(1)}ms`,
  );
}

function handleError(req, res, err) {
  if (err instanceof HttpError) {
    const extraHeaders = err.status === 401 ? authChallengeHeaders() : undefined;
    if (extraHeaders) {
      res.writeHead(401, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        ...extraHeaders,
      });
      res.end(JSON.stringify({ error: { status: 401, message: err.message } }));
      return;
    }
    sendError(res, err.status, err.message, err.details);
    return;
  }
  // eslint-disable-next-line no-console
  console.error('Unhandled error processing request:', err);
  sendError(res, 500, 'Internal Server Error');
}

export function createApp(config) {
  const store = createBookStore();
  const handlers = createBooksHandlers({ store, config });
  const router = createRouter({ config, handlers });

  const server = createServer(async (req, res) => {
    const startNs = process.hrtime.bigint();
    res.on('finish', () => logRequest(req, res, startNs));

    try {
      const url = buildUrl(req);
      authenticate(req, config);
      const { handler, params } = router.resolve(req.method, url.pathname);
      await handler(req, res, { url, params });
    } catch (err) {
      handleError(req, res, err);
    }
  });

  return { server, store };
}
