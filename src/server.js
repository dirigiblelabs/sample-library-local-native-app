import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const { server } = createApp(config);

server.listen(config.port, config.host, () => {
  const { port, host, apiBasePath } = config;
  // eslint-disable-next-line no-console
  console.log(`sample-library-native-app-nodejs listening on http://${host}:${port}${apiBasePath}`);
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  // eslint-disable-next-line no-console
  console.log(`Received ${signal}, shutting down...`);

  const forceExit = setTimeout(() => {
    // eslint-disable-next-line no-console
    console.error('Forcing shutdown after timeout');
    process.exit(1);
  }, config.shutdownTimeoutMs);
  forceExit.unref();

  server.close((err) => {
    if (err) {
      // eslint-disable-next-line no-console
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
    process.exit(0);
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(signal));
}
