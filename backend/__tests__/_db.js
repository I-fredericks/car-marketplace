// One pooled PrismaClient shared across all Jest workers/suites. Parallel
// `new PrismaClient()` instances were tripping Supabase's session limit
// (max clients 15) — one client here + the app client's pool stays inside
// the ceiling. The process exits via jest --forceExit, so no afterAll
// disconnect (declaring hooks mid-life-cycle throws in Jest).
const { PrismaClient } = require('@prisma/client');
module.exports = new PrismaClient();
