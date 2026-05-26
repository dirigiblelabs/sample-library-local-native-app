import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

export async function startTestServer(overrides = {}) {
  const config = {
    ...loadConfig({ PORT: '0', AUTH_USER: 'admin', AUTH_PASSWORD: 'admin' }),
    ...overrides,
  };
  const { server } = createApp(config);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}${config.apiBasePath}`;

  const basic = Buffer.from(`${config.authUser}:${config.authPassword}`).toString('base64');
  const authHeader = `Basic ${basic}`;

  return {
    baseUrl,
    authHeader,
    config,
    async stop() {
      await new Promise((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    },
  };
}

export async function callJson(url, { method = 'GET', headers = {}, body, authHeader } = {}) {
  const fetchHeaders = { Accept: 'application/json', ...headers };
  if (authHeader && !('Authorization' in fetchHeaders)) {
    fetchHeaders.Authorization = authHeader;
  }
  if (body !== undefined && !('Content-Type' in fetchHeaders)) {
    fetchHeaders['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, {
    method,
    headers: fetchHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { status: res.status, headers: res.headers, body: parsed };
}
