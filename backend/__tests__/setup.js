// Tests must run in "dev mailer" mode: the auth suite depends on
// devVerificationToken being returned when SMTP is not configured. A local
// .env with real SMTP credentials would otherwise swallow those tokens and
// break the suite. Set empty values (not delete) so dotenv.config() skips
// these keys and the mailer treats SMTP as unconfigured in tests.
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
