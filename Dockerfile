# ---- Backend API ----
# Build frontend static assets, install only backend production deps, run API.
FROM node:22-alpine AS backend

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY backend/src ./src
COPY backend/prisma ./prisma
# Client is generated during npm ci (postinstall) from the copied schema;
# regenerate to be safe after the full prisma dir is in place.
RUN npx prisma generate

ENV NODE_ENV=production
EXPOSE 5000

# Container-friendly defaults (override with -e or compose)
ENV PORT=5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]

# ---- Frontend build (separate stage, output consumed by nginx or the API image) ----
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./
RUN npm run build
# Resulting assets: /app/frontend/dist
