// Force the suite onto a test database: local Postgres in CI, Supabase's
// carmarket_test in dev. dotenv never overrides a var that already exists,
// so setting it here wins over whatever .env holds — unless CI already
// provided its own DATABASE_URL (local Postgres service container).
//
// connection_limit: the pooler's session ceiling is 15. Jest --forceExit can
// leave zombie sessions behind after crashed runs, and every suite spawns
// the app client + a shared assertion client — capping each Prisma pool at
// 3 connections keeps the sum comfortably under the ceiling.
// Load .env BEFORE reading TEST_DATABASE_URL — setup.js runs as a Jest
// setupFile, which executes before the test file imports the app (where
// dotenv.config() normally runs). Without this, TEST_DATABASE_URL is
// undefined here and tests silently hit the production database.
require('dotenv').config();

process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
// ALWAYS force the test database — never let dotenv's prod DATABASE_URL
// leak into tests. CI provides DATABASE_URL (local Postgres); dev provides
// TEST_DATABASE_URL (Supabase carmarket_test) in .env or shell.
const testDbUrl = process.env.TEST_DATABASE_URL
  ? `${process.env.TEST_DATABASE_URL}?connection_limit=3&pool_timeout=30`
  : process.env.DATABASE_URL; // CI's local Postgres service container
process.env.DATABASE_URL = testDbUrl;
