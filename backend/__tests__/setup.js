// Force the suite onto its own Supabase database (carmarket_test): identical
// schema to production, zero real data to protect. dotenv never overrides a
// var that already exists, so setting it here wins over whatever .env holds.
// This prevents the lifecycle tests from ever writing life-*/test-accounts
// into the production database again.
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
process.env.DATABASE_URL = 'postgresql://postgres.epzaslgsameivwezwhso:Carmarket509xyz@aws-0-eu-central-1.pooler.supabase.com:5432/carmarket_test';
