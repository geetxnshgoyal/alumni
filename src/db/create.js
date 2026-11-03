// Creates the development and test databases if they do not exist yet.
// Usage: npm run db:create
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });
const { Client } = require('pg');

async function ensureDatabase(url) {
  const target = new URL(url);
  const dbName = target.pathname.replace(/^\//, '');
  const admin = new URL(url);
  admin.pathname = '/postgres';

  const client = new Client({
    connectionString: admin.toString(),
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (rowCount) {
      console.log(`Database "${dbName}" already exists`);
    } else {
      // Identifiers cannot be parameterised; quote it safely instead.
      await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
      console.log(`Created database "${dbName}"`);
    }
  } finally {
    await client.end();
  }
}

(async () => {
  const urls = [process.env.DATABASE_URL, process.env.TEST_DATABASE_URL].filter(Boolean);
  if (!urls.length) {
    console.error('Set DATABASE_URL (and TEST_DATABASE_URL) in .env first');
    process.exit(1);
  }
  for (const url of urls) await ensureDatabase(url);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
