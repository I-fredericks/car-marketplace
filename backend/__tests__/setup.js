// Force the suite onto a test database: local Postgres in CI, Supabase's
// carmarket_test in dev. dotenv never overrides a var that already exists,
// so setting it here wins over whatever .env holds — unless CI already
// provided its own DATABASE_URL (local Postgres service container).
//
// connection_limit: the pooler's session ceiling is 15. Jest --forceExit can
// leave zombie sessions behind after crashed runs, and every suite spawns
// the app client + a shared assertion client — capping each Prisma pool at
// 3 connections keeps the sum comfortably under the ceiling.
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres.epzaslgsameivwezwhso:Carmarket509xyz@aws-0-eu-central-1.pooler.supabase.com:5432/carmarket_test?connection_limit=3&pool_timeout=30';
}
