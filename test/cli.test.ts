import { describe, expect, it } from 'vitest';
import { parseCliOverrides } from '../src/cli.js';

describe('parseCliOverrides', () => {
  it('returns empty overrides and help=false for no flags', () => {
    expect(parseCliOverrides([])).toEqual({ envOverrides: {}, help: false });
  });

  it('maps every long flag to its corresponding env-var key', () => {
    const { envOverrides } = parseCliOverrides([
      '--port=9090',
      '--host=127.0.0.1',
      '--auth-user=alice',
      '--auth-password=s3cret',
      '--log-level=debug',
      '--api-base-path=/api',
      '--library-address=42 Wallaby Way, Sydney',
      '--library-phone=+61-2-9999-0042',
    ]);
    expect(envOverrides).toEqual({
      PORT: '9090',
      HOST: '127.0.0.1',
      AUTH_USER: 'alice',
      AUTH_PASSWORD: 's3cret',
      LOG_LEVEL: 'debug',
      API_BASE_PATH: '/api',
      LIBRARY_ADDRESS: '42 Wallaby Way, Sydney',
      LIBRARY_PHONE: '+61-2-9999-0042',
    });
  });

  it('only emits keys for flags that were supplied', () => {
    const { envOverrides } = parseCliOverrides(['--library-phone=555']);
    expect(envOverrides).toEqual({ LIBRARY_PHONE: '555' });
  });

  it('accepts space-separated flag values', () => {
    const { envOverrides } = parseCliOverrides(['--port', '7000']);
    expect(envOverrides).toEqual({ PORT: '7000' });
  });

  it('recognizes --help and -h', () => {
    expect(parseCliOverrides(['--help']).help).toBe(true);
    expect(parseCliOverrides(['-h']).help).toBe(true);
  });

  it('throws on an unknown flag', () => {
    expect(() => parseCliOverrides(['--nope=1'])).toThrow();
  });

  it('throws on a positional argument', () => {
    expect(() => parseCliOverrides(['hello'])).toThrow();
  });
});
