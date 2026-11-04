// Minimal migration runner: applies every .sql file in ./migrations once, in filename order.
// Applied files are recorded in the schema_migrations table with a checksum, so editing a file
// after it was applied produces a warning instead of being silently ignored.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function migrate({ silent = false } = {}) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query('ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum CHAR(64)');

  const { rows } = await pool.query('SELECT name, checksum FROM schema_migrations');
  const applied = new Map(rows.map((r) => [r.name, r.checksum]));
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');

    if (applied.has(file)) {
      const recorded = applied.get(file);
      if (!recorded) {
        // Applied before checksums were recorded: trust it and start tracking from now.
        await pool.query('UPDATE schema_migrations SET checksum = $2 WHERE name = $1', [file, checksum]);
      } else if (recorded !== checksum) {
        console.warn(
          `Warning: ${file} changed after it was applied, so this database still has the old version.\n` +
            '  Local database: run `npm run db:reset`. Shared/hosted database: add a new migration instead of editing this one.'
        );
      }
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [file, checksum]);
      await client.query('COMMIT');
      if (!silent) console.log(`Applied ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${err.message}`);
    } finally {
      client.release();
    }
  }
}

module.exports = { migrate };

if (require.main === module) {
  migrate()
    .then(() => console.log('Migrations up to date'))
    .catch((err) => {
      console.error(err.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
