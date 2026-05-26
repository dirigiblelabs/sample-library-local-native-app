const DEFAULTS = Object.freeze({
  port: 8080,
  host: '0.0.0.0',
  authUser: 'admin',
  authPassword: 'admin',
  apiBasePath: '/rest/api/v1',
  shutdownTimeoutMs: 10_000,
});

function parsePort(value, fallback) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
    throw new Error(`Invalid PORT value: ${value}`);
  }
  return parsed;
}

export function loadConfig(env = process.env) {
  return Object.freeze({
    port: parsePort(env.PORT, DEFAULTS.port),
    host: env.HOST || DEFAULTS.host,
    authUser: env.AUTH_USER || DEFAULTS.authUser,
    authPassword: env.AUTH_PASSWORD || DEFAULTS.authPassword,
    apiBasePath: DEFAULTS.apiBasePath,
    shutdownTimeoutMs: DEFAULTS.shutdownTimeoutMs,
  });
}
