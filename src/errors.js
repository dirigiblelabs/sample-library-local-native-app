export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    if (details !== undefined) this.details = details;
  }
}

export const badRequest = (msg, details) => new HttpError(400, msg, details);
export const unauthorized = (msg = 'Authentication required') => new HttpError(401, msg);
export const notFound = (msg = 'Resource not found') => new HttpError(404, msg);
export const methodNotAllowed = (msg = 'Method not allowed') => new HttpError(405, msg);
export const conflict = (msg, details) => new HttpError(409, msg, details);
export const unsupportedMediaType = (msg = 'Unsupported Media Type') => new HttpError(415, msg);
