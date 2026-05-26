import { parseArgs } from 'node:util';

export const USAGE = `Usage: server [options]

Options:
  --port=<n>              TCP port (env PORT, default 8080)
  --host=<addr>           Bind address (env HOST, default 0.0.0.0)
  --auth-user=<u>         Basic auth username (env AUTH_USER, default admin)
  --auth-password=<p>     Basic auth password (env AUTH_PASSWORD, default admin)
  --log-level=<lvl>       Pino level (env LOG_LEVEL, default info)
  --api-base-path=<p>     API base path (env API_BASE_PATH, default /rest/api/v1)
  --library-address=<a>   Library address (env LIBRARY_ADDRESS)
  --library-phone=<p>     Library phone (env LIBRARY_PHONE)
  -h, --help              Show this help

Precedence: CLI flag > env var > default.
`;

export interface ParsedCli {
  envOverrides: NodeJS.ProcessEnv;
  help: boolean;
}

export function parseCliOverrides(argv: string[]): ParsedCli {
  const { values } = parseArgs({
    args: argv,
    options: {
      port: { type: 'string' },
      host: { type: 'string' },
      'auth-user': { type: 'string' },
      'auth-password': { type: 'string' },
      'log-level': { type: 'string' },
      'api-base-path': { type: 'string' },
      'library-address': { type: 'string' },
      'library-phone': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
    allowPositionals: false,
  });

  const envOverrides: NodeJS.ProcessEnv = {};
  const set = (envKey: string, val: string | boolean | undefined): void => {
    if (typeof val === 'string') envOverrides[envKey] = val;
  };
  set('PORT', values.port);
  set('HOST', values.host);
  set('AUTH_USER', values['auth-user']);
  set('AUTH_PASSWORD', values['auth-password']);
  set('LOG_LEVEL', values['log-level']);
  set('API_BASE_PATH', values['api-base-path']);
  set('LIBRARY_ADDRESS', values['library-address']);
  set('LIBRARY_PHONE', values['library-phone']);

  return { envOverrides, help: values.help === true };
}
