# syntax=docker/dockerfile:1

# ───────────── Stage 1: build dashboard + generate Prisma client ─────────────
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Toolchain for compiling better-sqlite3 if a prebuilt binary isn't available.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies first so this layer is cached unless a manifest changes.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci

# Bring in the rest of the source and produce the build artifacts.
COPY . .
RUN npm --workspace @forwarder/server run prisma:generate \
  && npm run build

# ──────────────────────────── Stage 2: runtime ──────────────────────────────
FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=file:/data/forwarder.db
WORKDIR /app

# node_modules carries the native better-sqlite3 binary, the Prisma engines +
# generated client, plus the tsx/prisma CLIs — all built for this same base.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/server ./apps/server
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/apps/web/dist ./apps/web/dist

# SQLite database lives on a mounted volume so it survives container restarts.
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Apply pending migrations against the volume DB, then hand PID 1 to the server
# (exec) so SIGTERM reaches the graceful-shutdown handler in index.ts.
WORKDIR /app/apps/server
CMD ["sh", "-c", "/app/node_modules/.bin/prisma migrate deploy && exec /app/node_modules/.bin/tsx src/index.ts"]
