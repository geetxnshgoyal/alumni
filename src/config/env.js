const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });
const { z } = require('zod');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  TEST_DATABASE_URL: z.string().optional(),
  DATABASE_SSL: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  GOOGLE_CLIENT_ID: z.string().optional().default('test_google_client_id'),
  GOOGLE_CLIENT_SECRET: z.string().optional().default('test_google_client_secret'),
  GOOGLE_CALLBACK_URL: z.string().optional().default('http://localhost:3000/api/auth/oauth/google/callback'),
  CORS_ORIGIN: z.string().optional().default(''),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`Invalid environment configuration:\n${problems}\nSee .env.example`);
  process.exit(1);
}

const env = parsed.data;

// Tests run against a separate database so they can safely wipe tables.
if (env.NODE_ENV === 'test') {
  if (!env.TEST_DATABASE_URL) {
    console.error('TEST_DATABASE_URL is required when running tests');
    process.exit(1);
  }
  env.DATABASE_URL = env.TEST_DATABASE_URL;
}

env.corsOrigins = env.CORS_ORIGIN.split(',')
  .map((o) => o.trim())
  .filter(Boolean);

module.exports = env;
