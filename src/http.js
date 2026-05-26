import { badRequest, unsupportedMediaType } from './errors.js';

const MAX_BODY_BYTES = 1_048_576; // 1 MiB

export async function readJsonBody(req) {
  const method = req.method?.toUpperCase();
  if (method === 'GET' || method === 'DELETE' || method === 'HEAD') {
    return undefined;
  }

  const contentLengthHeader = req.headers['content-length'];
  if (contentLengthHeader !== undefined) {
    const declared = Number(contentLengthHeader);
    if (!Number.isFinite(declared) || declared < 0) {
      throw badRequest('Invalid Content-Length header');
    }
    if (declared > MAX_BODY_BYTES) {
      throw badRequest(`Request body exceeds maximum size of ${MAX_BODY_BYTES} bytes`);
    }
    if (declared === 0) return undefined;
  }

  const contentType = (req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
  if (contentType && contentType !== 'application/json') {
    throw unsupportedMediaType(`Content-Type must be application/json, got: ${contentType}`);
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw badRequest(`Request body exceeds maximum size of ${MAX_BODY_BYTES} bytes`);
    }
    chunks.push(chunk);
  }

  if (size === 0) return undefined;

  const raw = Buffer.concat(chunks, size).toString('utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw badRequest(`Malformed JSON: ${err.message}`);
  }
}

export function sendJson(res, status, body, extraHeaders = {}) {
  const payload = body === undefined ? '' : JSON.stringify(body);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  };
  if (payload) {
    headers['Content-Length'] = Buffer.byteLength(payload);
  } else {
    delete headers['Content-Type'];
  }
  res.writeHead(status, headers);
  res.end(payload);
}

export function sendNoContent(res, extraHeaders = {}) {
  res.writeHead(204, extraHeaders);
  res.end();
}

export function sendError(res, status, message, details) {
  const body = { error: { status, message } };
  if (details !== undefined) body.error.details = details;
  sendJson(res, status, body);
}
