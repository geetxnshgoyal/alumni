const app = require('./app');
const env = require('./config/env');
const { pool } = require('./db/pool');

const server = app.listen(env.PORT, () => {
  console.log(`Alumni platform running on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(() => pool.end().then(() => process.exit(0)));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
