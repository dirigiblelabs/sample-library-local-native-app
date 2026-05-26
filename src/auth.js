import { timingSafeEqual } from 'node:crypto';
import { unauthorized } from './errors.js';

const REALM = 'sample-library';

function safeStringEquals(a, b) {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // Still run timingSafeEqual against a same-length buffer to keep timing flat.
    timingSafeEqual(bufA, Buffer.alloc(bufA.length));
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function parseBasic(header) {
  if (!header || typeof header !== 'string') return null;
  const [scheme, encoded] = header.split(' ', 2);
  if (!scheme || scheme.toLowerCase() !== 'basic' || !encoded) return null;
  let decoded;
  try {
    decoded = Buffer.from(encoded, 'base64').toString('utf8');
  } catch {
    return null;
  }
  const sepIdx = decoded.indexOf(':');
  if (sepIdx < 0) return null;
  return {
    username: decoded.slice(0, sepIdx),
    password: decoded.slice(sepIdx + 1),
  };
}

export function authChallengeHeaders() {
  return { 'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"` };
}

export function authenticate(req, config) {
  const credentials = parseBasic(req.headers['authorization']);
  if (!credentials) {
    throw unauthorized('Missing or malformed Authorization header');
  }
  const userOk = safeStringEquals(credentials.username, config.authUser);
  const passOk = safeStringEquals(credentials.password, config.authPassword);
  if (!userOk || !passOk) {
    throw unauthorized('Invalid credentials');
  }
  return { username: credentials.username };
}
