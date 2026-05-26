import { buildApp } from './app.js';
import { parseCliOverrides, USAGE } from './cli.js';
import { loadConfig } from './config.js';

async function main(): Promise<void> {
  const parsed = (() => {
    try {
      return parseCliOverrides(process.argv.slice(2));
    } catch (err) {
      process.stderr.write(`${(err as Error).message}\n\n${USAGE}`);
      process.exit(2);
    }
  })();

  if (parsed.help) {
    process.stdout.write(USAGE);
    return;
  }

  const config = loadConfig({ ...process.env, ...parsed.envOverrides });
  const { app } = await buildApp(config);

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'Shutting down');
    try {
      await app.close();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      void shutdown(signal);
    });
  }

  try {
    const address = await app.listen({ port: config.port, host: config.host });
    app.log.info(`API ready at ${address}${config.apiBasePath} — docs at ${address}/docs`);
  } catch (err) {
    app.log.error({ err }, 'Failed to start');
    process.exit(1);
  }
}

void main();
