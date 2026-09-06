# Production go-live checklist (CarMarket Ghana)

Deployment mechanics live in [DEPLOY.md](DEPLOY.md). This is the ordered list
of gates to clear **before** and **after** the first public deploy. Decisions
made for v1: **single VM + PM2** (not Docker), **Flutter app is the only
public client** (the web `frontend/` stays internal).

## 0. Secrets — do this first, once

Secrets were committed to an earlier GitHub repo, so treat every old value as
public. Rotation is a dashboard/CLI task only you can do:

- [ ] `JWT_SECRET` → `openssl rand -hex 32` (invalidates all existing sessions — fine)
- [ ] Paystack: roll secret keys in the dashboard, update the webhook URL + secret
- [ ] SMTP password (mail provider) — new app password
- [ ] MySQL: new password for the app user (never ship root/empty-password)
- [ ] Confirm no `.env`, `node_modules/`, `uploads/` are tracked: `git ls-files | grep -E '\.env$|node_modules'` → empty
- [ ] `backend/.env.example` stays the only committed env template

## 1. Server (Hetzner/DigitalOcean, 2 vCPU / 4 GB)

- [ ] Ubuntu 24.04, Node 22, MySQL 8, `npm i -g pm2`
- [ ] Create DB + least-privilege user (commands in DEPLOY.md §2)
- [ ] `pm2 start ecosystem.config.js && pm2 save && pm2 startup`
      (**keep `instances: 1`** — the SSE event bus is per-process; the file
      documents this)
- [ ] TLS in front: Cloudflare proxy (free) with an origin cert, or Caddy/nginx + Let's Encrypt
- [ ] `FRONTEND_URL=https://<domain>` (CORS allowlist), `NODE_ENV=production`
- [ ] SMTP set — **required**: `forgot-password` returns 503 without it in production
- [ ] Optional but recommended: `S3_*` (images off the VM disk), `REDIS_URL` (hot search cache)

## 2. Database

- [ ] `npx prisma migrate deploy` (never `db push` on prod)
- [ ] Seed **manually, not with the dev seed's demo users**: create the real
      admin with `ADMIN_PASSWORD=<strong>` and skip `Password123!` demo
      sellers/buyers — or run the seed then immediately delete demo accounts
- [ ] Verify: `SELECT email FROM user;` shows no `@carmarket.com` demo rows
- [ ] Backups: `scripts/backup-db.sh` exists — schedule it:
      `crontab -e` → `15 3 * * * /path/to/scripts/backup-db.sh >> /var/log/cm-backup.log 2>&1`
      and copy/ship the dump off-box (rclone to S3/R2 free tier)
- [ ] **Restore drill once**: import a dump into a scratch DB before you need it for real

## 3. Monitor

- [ ] UptimeRobot (free) → `https://<domain>/api/health` (checks DB, not just process)
- [ ] `pm2 logs` rotated (default PM2 log rotation: `pm2 install pm2-logrotate`)
- [ ] Optional: Sentry free tier — set `SENTRY_DSN`, add `@sentry/node` init in `src/index.js`

## 4. Flutter app release

- [ ] Pick the final `applicationId` in `android/app/build.gradle.kts`
      (currently the template `com.example.car_marketplace`) — immutable once on Play
- [ ] `flutter build apk --release --dart-define=API_BASE_URL=https://<domain>` (never the localhost fallback)
- [ ] App signing key + keystore backed up (loss = can't update the app ever).
      `android/app/build.gradle.kts` reads `android/key.properties` (git-ignored);
      the keytool + properties recipe is in that file's header comment
- [ ] `--obfuscate --split-debug-info=build/symbols` for release builds
- [ ] App icons/splash (`flutter_launcher_icons`)
- [ ] Play Store listing needs: privacy policy URL (see §5), data-safety form
      (collects: email, name, phone; payments via Paystack, not stored)

## 5. Legal / product gates

- [ ] Privacy Policy + Terms pages hosted (Paystack requires it; Play Store requires a privacy policy URL)
- [ ] Support contact reachable (deactivation/takedown notices point at it)

## 6. Post-deploy smoke test (15 minutes)

- [ ] Register → listing flow with real photos; admin approve; listing visible to a second account
- [ ] Chat between two accounts: message arrives live (SSE) + badge clears on read
- [ ] Password reset email actually arrives (validates SMTP)
- [ ] Paystack **test-mode first**: checkout → webhook verified (check `pm2 logs` for the ✅ line) → plan activated
- [ ] Admin: takedown, user deactivation, audit log entries appear
- [ ] `curl -s https://<domain>/api/health` → `{"status":"OK","db":"up"}`

## Known accepted limitations (v1)

- SSE + in-memory event bus: single PM2 worker only. Scaling past one node
  means moving the bus to Redis pub/sub (`services/eventBus.js`).
- Push notifications are in-app only (no FCM); users see updates on app open.
- `express.json` accepts 50 MB bodies (edit flow re-sends base64 images);
  per-image zod caps (≤ ~9 MB, 15 images) bound the actual risk. Revisit when
  the S3 migration removes base64 editing.
