import { badRequest } from './errors.js';

const MAX_STRING = 500;
const MIN_YEAR = -3000;
const MAX_YEAR = new Date().getUTCFullYear() + 5;

const ALLOWED_FIELDS = new Set([
  'title',
  'author',
  'isbn',
  'publishedYear',
  'genre',
  'available',
]);

const REQUIRED_FIELDS = ['title', 'author'];

function requireObject(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Request body must be a JSON object');
  }
}

function rejectUnknown(body) {
  const unknown = Object.keys(body).filter((k) => !ALLOWED_FIELDS.has(k));
  if (unknown.length > 0) {
    throw badRequest(`Unknown field(s): ${unknown.join(', ')}`, { unknown });
  }
}

function validateString(name, value, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) throw badRequest(`Field "${name}" is required`);
    return undefined;
  }
  if (typeof value !== 'string') {
    throw badRequest(`Field "${name}" must be a string`);
  }
  const trimmed = value.trim();
  if (required && trimmed.length === 0) {
    throw badRequest(`Field "${name}" must not be blank`);
  }
  if (trimmed.length > MAX_STRING) {
    throw badRequest(`Field "${name}" exceeds maximum length of ${MAX_STRING}`);
  }
  return trimmed;
}

function validateYear(value) {
  if (value === undefined || value === null) return undefined;
  if (!Number.isInteger(value) || value < MIN_YEAR || value > MAX_YEAR) {
    throw badRequest(`Field "publishedYear" must be an integer between ${MIN_YEAR} and ${MAX_YEAR}`);
  }
  return value;
}

function validateBoolean(name, value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') {
    throw badRequest(`Field "${name}" must be a boolean`);
  }
  return value;
}

function normalizeIsbn(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw badRequest('Field "isbn" must be a string');
  const stripped = value.replace(/[\s-]/g, '');
  if (stripped.length === 0) return undefined;
  if (!/^[0-9Xx]{10}$|^[0-9]{13}$/.test(stripped)) {
    throw badRequest('Field "isbn" must be a valid ISBN-10 or ISBN-13');
  }
  return stripped.toUpperCase();
}

export function validateCreate(body) {
  requireObject(body);
  rejectUnknown(body);
  for (const field of REQUIRED_FIELDS) {
    if (!(field in body)) throw badRequest(`Field "${field}" is required`);
  }
  return {
    title: validateString('title', body.title, { required: true }),
    author: validateString('author', body.author, { required: true }),
    isbn: normalizeIsbn(body.isbn),
    publishedYear: validateYear(body.publishedYear),
    genre: validateString('genre', body.genre),
    available: validateBoolean('available', body.available) ?? true,
  };
}

export function validateReplace(body) {
  return validateCreate(body);
}

export function validatePatch(body) {
  requireObject(body);
  rejectUnknown(body);
  if (Object.keys(body).length === 0) {
    throw badRequest('Request body must contain at least one field');
  }
  const patch = {};
  if ('title' in body) patch.title = validateString('title', body.title, { required: true });
  if ('author' in body) patch.author = validateString('author', body.author, { required: true });
  if ('isbn' in body) patch.isbn = normalizeIsbn(body.isbn);
  if ('publishedYear' in body) patch.publishedYear = validateYear(body.publishedYear);
  if ('genre' in body) patch.genre = validateString('genre', body.genre);
  if ('available' in body) patch.available = validateBoolean('available', body.available);
  return patch;
}
