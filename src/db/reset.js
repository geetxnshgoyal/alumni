// Drops and recreates the local development and test databases (all data is lost).
// Use it when a migration you already applied has changed. Usage: npm run db:reset
// (which then runs migrate and seed).
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });
const { Client } = require('pg');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

async function recreate(url) {
  const target = new URL(url);
  if (!LOCAL_HOSTS.has(target.hostname)) {
    throw new Error(`Refusing to reset "${target.hostname}": db:reset only works on a local database`);
  }
  const dbName = target.pathname.replace(/^\//, '');
  const admin = new URL(url);
  admin.pathname = '/postgres';

  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    // Identifiers cannot be parameterised; quote it safely instead.
    const quoted = `"${dbName.replace(/"/g, '""')}"`;
    await client.query(`DROP DATABASE IF EXISTS ${quoted} WITH (FORCE)`);
    await client.query(`CREATE DATABASE ${quoted}`);
    console.log(`Recreated database "${dbName}"`);
  } finally {
    await client.end();
  }
}

(async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to reset when NODE_ENV=production');
  const urls = [process.env.DATABASE_URL, process.env.TEST_DATABASE_URL].filter(Boolean);
  if (!urls.length) throw new Error('Set DATABASE_URL (and TEST_DATABASE_URL) in .env first');
  for (const url of urls) await recreate(url);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
