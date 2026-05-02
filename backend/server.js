// Server entry point. Connects to MongoDB and starts the HTTP server.

const env = require('./src/config/env');
const { connectDB } = require('./src/config/db');
const app = require('./src/app');

(async function start() {
  try {
    await connectDB();
    app.listen(env.port, () => {
      // eslint-disable-next-line no-console
      console.log(`[server] SparrowPay API listening on http://localhost:${env.port} (${env.nodeEnv})`);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[server] failed to start:', err.message);
    process.exit(1);
  }
})();

// Graceful shutdown.
['SIGINT', 'SIGTERM'].forEach((sig) => {
  process.on(sig, async () => {
    // eslint-disable-next-line no-console
    console.log(`\n[server] received ${sig}, shutting down…`);
    process.exit(0);
  });
});
