# syntax=docker/dockerfile:1.7
#
# Multi-stage Dockerfile für WM-Buchhaltung
#
# Stages:
#   - builder : installiert alle deps, kompiliert Frontend (Vite) + Backend (esbuild)
#   - runtime : schlankes Node-20-Alpine mit nur production-deps und dist/
#
# Build:
#   docker build -t wm-buchhaltung:latest .
#
# Run (mit externem MySQL):
#   docker run --rm -p 3000:3000 --env-file .env wm-buchhaltung:latest
#
# Für den kompletten Stack (App + MySQL + Migrate) siehe docker-compose.yml.

# ─── Stage 1: Builder ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Build-Tools für ggf. native Module (mysql2, pdf-lib, swissqrbill sind JS-only,
# aber andere Transitiven ziehen gelegentlich node-gyp nach).
RUN apk add --no-cache git python3 make g++

WORKDIR /app

# pnpm über corepack einfrieren (Version muss zu packageManager in package.json passen).
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# Package-Manifests zuerst kopieren, damit der Layer-Cache greift.
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# Alle Dependencies installieren (inkl. dev – werden für Build gebraucht).
RUN pnpm install --frozen-lockfile

# Source kopieren und bauen.
# Vite baut nach dist/public, esbuild bündelt das Backend nach dist/index.js.
COPY . .
RUN pnpm build

# Dev-Deps rauswerfen, damit wir node_modules direkt in die Runtime kopieren können.
RUN pnpm prune --prod

# ─── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

# tini als PID 1 für sauberes Signal-Handling (SIGTERM von Docker/K8s).
RUN apk add --no-cache tini wget

WORKDIR /app

# Non-root User anlegen.
RUN addgroup -g 1001 -S nodejs && \
    adduser  -u 1001 -S app -G nodejs

# Nur das übernehmen, was die Runtime wirklich braucht.
COPY --from=builder --chown=app:nodejs /app/package.json       ./package.json
COPY --from=builder --chown=app:nodejs /app/node_modules       ./node_modules
COPY --from=builder --chown=app:nodejs /app/dist               ./dist
# Template-PDF für Rechnungsgenerierung (swissqrbill nutzt das als Vorlage).
COPY --from=builder --chown=app:nodejs /app/server/templates   ./server/templates

USER app

ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

# /api/health wird vom Express-Server in server/_core/index.ts exponiert.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --quiet --spider http://localhost:${PORT}/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
