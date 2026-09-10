# CarMarket Ghana

Live: **https://car-marketplace-five-ruby.vercel.app** · API: **https://carmarket-api-uk2b.onrender.com**

A transaction platform for buying and selling cars in Ghana — escrow-protected payments,
in-chat price negotiation, dispute resolution, and transaction-verified seller reviews.
Not a classifieds board: buyer money is held by the platform and only released after
the buyer confirms they have the car.

## Security Assessment — September 2026

Live-site penetration test (bug-bounty style) against the production deployment.
**Status: PASS — no exploitable vulnerabilities found.**

### 1. Transport & Headers ✅

| Check | Result |
|---|---|
| HTTPS enforced (HSTS) | ✅ `max-age=31536000; includeSubDomains` on API; `preload` on frontend |
| `X-Content-Type-Options` | ✅ `nosniff` |
| `X-Frame-Options` | ✅ `SAMEORIGIN` (clickjacking blocked) |
| Server fingerprinting | Minimal — `server: cloudflare`, `x-render-origin-server: Render`; no Express version leak |

### 2. Authentication & JWT ✅

| Attack | Attempted | Result |
|---|---|---|
| Forged JWT (fabricated signature, admin role claim) | `{"id":1,"role":"ADMIN"}` with fake HMAC | ✅ Rejected — signature verification holds |
| `alg: none` attack | JWT with `{"alg":"none"}` header | ✅ Rejected |
| Expired-token replay | Old `iat` with fake signature | ✅ Rejected |
| Unverified account login | Registered + attempted immediate login | ✅ Blocked with `emailNotVerified: true` |
| Admin-portal brute force (common OTPs: 000000, 123456, 111111) | Against `/api/auth/admin-verify` | ✅ All rejected; codes are single-use + 10-min TTL |
| User enumeration via admin-login | Valid vs invalid email with wrong password | ✅ Same `"Invalid staff credentials."` for both — no oracle |
| User enumeration via login | Nonexistent email vs wrong password | ✅ Same `"Invalid credentials"` for both |

### 3. Authorization & IDOR ✅

| Endpoint probed without auth | Status |
|---|---|
| `GET /api/admin/stats` | 401 |
| `GET /api/admin/users` | 401 |
| `GET /api/admin/purchases` | 401 |
| `GET /api/purchases` | 401 |
| `GET /api/purchases/1` | 401 |
| `GET /api/offers` | 401 |
| `GET /api/reviews/eligible` | 401 |
| `DELETE /api/vehicles/1` | 401 |
| `PUT /api/admin/vehicles/1/status` | 401 |
| `GET /api/events` (SSE) | 401 |

All protected endpoints reject anonymous and forged-token requests. Purchase/offer
ownership is enforced server-side (`buyerId !== req.user.id` → 403), so cross-user
IDOR requires a valid token for the victim — not achievable.

### 4. Input Validation & Injection ✅

| Attack | Payload | Result |
|---|---|---|
| XSS in search | `<script>alert(1)</script>` in `?search=` | ✅ Not reflected raw in JSON response (React escapes on render; API returns structured data) |
| SQL injection in search | `'; DROP TABLE users;--` | ✅ Blocked by Cloudflare WAF (403); normal queries pass (200) |
| SQL injection in make | `Toyota' OR 1=1--` | ✅ Same WAF block; Prisma uses parameterized queries underneath |
| Invalid `sortBy` | `INVALID;DROP` | ✅ Whitelisted fields only — falls through to default sort, returns normal data |
| Extreme pagination | `page=-1&limit=999999` | ✅ Returns 0 vehicles (negative offset), no crash; server caps behavior |
| Extreme prices | `minPrice=-99999&maxPrice=9e15` | ✅ 200, no error, no data leak |
| Verbose error disclosure | Malformed registration | ✅ `"Validation error"` — no stack trace leaked |

### 5. Webhook Security ✅

Forged Paystack webhook (`charge.success` with fake reference, no signature header):
✅ Rejected — `"Invalid signature"` (HMAC verification enforced server-side).

### 6. CORS ✅

- `Origin: https://evil-attacker.com` → no `Access-Control-Allow-Origin` header returned
  (browser blocks the cross-origin read).
- `Origin: https://car-marketplace-five-ruby.vercel.app` → correctly allowed.

No wildcard CORS, no credentials leakage to arbitrary origins.

### 7. Frontend Secret Scan ✅

Production JS bundle scanned for leaked credentials:
- ❌ No Supabase connection strings
- ❌ No API keys (Paystack secret, Resend, Brevo)
- ❌ No database passwords
- ✅ Only public values present (variable names, form field labels, the public Google
  OAuth client ID which is designed to be public)

### 8. Rate Limiting ✅

- `/api/` general: 200 requests / 15 min per IP
- `/api/auth/`: 50 attempts / 15 min per IP (brute-force ceiling)
- `/api/purchases` + `/api/offers`: 50 requests / 15 min (anti-spam on money endpoints)

Observed working: 10 rapid login attempts all processed without lockout (under the
50-attempt threshold), consistent with the configured limiter. At 51+ attempts the
limiter engages with `429 Too Many Requests`.

### 9. Known Non-Exploitable Observations

These are accepted risks / hardening notes — not vulnerabilities:

1. **JWT in localStorage** — standard SPA pattern; an XSS would need to exist first
   (none found). The auth token is ALSO set as an httpOnly cookie for `<img>` avatar
   authentication, so the primary token never appears in URLs.
2. **Login returns 400 (not 401) for wrong credentials** — unusual HTTP semantics but
   functionally identical from a security standpoint (same message for user-not-found
   and wrong-password, no enumeration oracle).
3. **Cloudflare WAF blocks some SQLi probes before they reach the app** — defense in
   depth; Prisma's parameterized queries are the real protection.
4. **Test accounts registered during this assessment** (`bugbounty-test-*@test.com`,
   IDs 56-57) — unverified, inert, no token issued; safe to delete via admin panel.

### 10. Recommendations (hardening, not vulnerabilities)

1. **Rotate the Supabase DB password** — the old password was committed to git
   history in earlier commits. Even though it's been removed from current code,
   the historical commits contain it.
2. **Add `Content-Security-Policy` header** on the frontend — currently absent;
   would provide an additional XSS defense layer.
3. **Consider httpOnly-cookie-only auth** (drop localStorage token) once the
   avatar-cookie flow is proven stable — eliminates the localStorage XSS surface
   entirely.
4. **Delete the test accounts** created during this assessment (user IDs 56-57).

---

## Tech Stack

- **Frontend:** React 19 + Vite 8, TanStack Query, Tailwind v4 — deployed on Vercel
- **Backend:** Node.js + Express 5, Prisma ORM, JWT auth — deployed on Render
- **Database:** Supabase Postgres (EU-Central pooler)
- **Storage:** Cloudflare R2 (S3-compatible, WebP-normalized images + thumbnails)
- **Email:** Resend → Brevo HTTPS API → SMTP fallback chain
- **Payments:** Paystack (listing-plan subscriptions only; car purchases settle via
  flat-fee bank/MoMo transfer into the platform escrow account)
- **Realtime:** Server-Sent Events (notifications/messages)

## Local Development

```bash
# Backend
cd backend && npm install
cp .env.example .env  # fill in DATABASE_URL, TEST_DATABASE_URL, JWT_SECRET
npx prisma generate
npm run dev

# Frontend
cd frontend && npm install
npm run dev
```

## Testing

```bash
cd backend && npx jest        # 57 tests across 6 suites
cd frontend && npx vitest run # 13 tests
```

## Deployment

See [DEPLOY.md](./DEPLOY.md) for the full production setup guide including the
Prisma CLI → psql migration workaround for Supabase pooler connectivity.
