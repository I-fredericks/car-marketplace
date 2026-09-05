# Deploying CarMarket Ghana

Two supported paths: **Docker Compose** (recommended for a single VM) or
**PM2** on a bare Node host. Both serve the built frontend through the
Express backend (`backend/src/index.js` serves `frontend/dist` when present).

## 0. Prerequisites

- A Linux server (2 vCPU / 4GB is plenty to start), Docker or Node 22+
- A domain pointed at the server (e.g. `carmarket.com.gh`)
- Secrets ready: `JWT_SECRET` (`openssl rand -hex 32`), MySQL passwords,
  Paystack + Google OAuth keys. **All secrets that were ever committed to
  the old repo must be rotated before going live.**

## 1. Docker Compose deploy

```bash
git clone <repo> car-marketplace && cd car-marketplace

# build the frontend once (and after every frontend change)
cd frontend && npm ci && npm run build && cd ..
mkdir -p frontend-dist && cp -r frontend/dist/* frontend-dist/

# configure
cat > .env <<'EOF'
MYSQL_ROOT_PASSWORD=<strong password>
MYSQL_PASSWORD=<strong password>
JWT_SECRET=<openssl rand -hex 32>
FRONTEND_URL=https://carmarket.com.gh
PAYSTACK_SECRET_KEY=sk_live_...
GOOGLE_CLIENT_ID=...
EOF

docker compose up -d --build
docker compose exec api npx prisma migrate deploy   # schema
```

Health: `curl http://localhost:5000/api/health` → `{"status":"OK","db":"up"}`.

Optional production extras (same `.env`):
- `REDIS_URL=redis://redis:6379` (already wired in compose) — enables the
  listing-search cache
- `S3_*` vars — offload new images to S3/R2/Spaces instead of local disk

## 2. PM2 deploy (no Docker)

```bash
# on the server
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs mysql-server
sudo mysql -e "CREATE DATABASE carmarketplace; CREATE USER 'carmarket'@'localhost' IDENTIFIED BY '<password>'; GRANT ALL ON carmarketplace.* TO 'carmarket'@'localhost';"

git clone <repo> car-marketplace && cd car-marketplace
cd backend && cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, ...
npm ci && npx prisma migrate deploy

cd ../frontend && npm ci && npm run build
cd .. && npm i -g pm2 && pm2 start ecosystem.config.js && pm2 save
pm2 startup   # follow the printed command to survive reboots
```

Note: `ecosystem.config.js` pins `exec_mode: fork` because the SSE event bus
is in-process. Switch to cluster mode only after moving the bus to Redis
pub/sub.

## 3. HTTPS

Simplest: Caddy (automatic Let's Encrypt):

```
# /etc/caddy/Caddyfile
carmarket.com.gh {
    reverse_proxy 127.0.0.1:5000
}
```

`sudo apt install caddy && sudo systemctl reload caddy`. nginx + certbot
works equally well — proxy to `127.0.0.1:5000` and forward
`X-Forwarded-For` (the app already sets `trust proxy 1`).

## 4. Backups

```bash
crontab -e
0 2 * * *  /opt/car-marketplace/scripts/backup-db.sh >> /var/log/carmarket-backup.log 2>&1
```

Dumps land in `./backups`, gzipped, 14-day rotation. Copy them off-server
(rclone to object storage is a good pattern):

```bash
rclone copy backups/ remote:carmarket-backups/$(hostname)/
```

Also back up `backend/uploads/` (or rely on S3 once enabled) and `.env`.

## 5. Monitoring

- Liveness + DB readiness: `GET /api/health` — point any uptime checker
  (UptimeRobot, Better Stack, or a simple cron `curl -f`) at
  `https://<domain>/api/health`
- Logs: `docker compose logs -f api` / `pm2 logs` — morgan request logs go
  to stdout; errors are clearly labelled
- PM2: `pm2 monit` for memory/CPU; `max_memory_restart` is set to 512M
- Database: watch slow queries; the hot listing query is indexed
  (Vehicle(status,createdAt), (status,price), (make,model)) and cached in
  Redis when `REDIS_URL` is set

## 6. Staging environment

Duplicate the compose setup on a second host (or second compose project +
port) with:
- Its own MySQL volume and its own `JWT_SECRET`
- Paystack **test** keys and Paystack test webhook pointed at the staging URL
- `FRONTEND_URL=https://staging.<domain>` (webhooks/CORS origins differ)
- Seed data: `docker compose exec api npm run seed` with a strong
  `SEED_PASSWORD`

## 7. Going-live checklist

- [ ] Rotate every secret ever committed to the repo (JWT done; Paystack, DB,
      SMTP, Google still pending)
- [ ] `NODE_ENV=production` (kills the dev-only reset-token response)
- [ ] Paystack webhook URL set in the dashboard → `https://<domain>/api/billing/webhook`
- [ ] Google OAuth: production origin added; Android app uses the Web client
      ID as `serverClientId`
- [ ] Privacy Policy + Terms links in the footer point at the new domain
- [ ] First backup restored to a scratch DB to prove it works
- [ ] `/api/health` added to an uptime monitor
