# syntax=docker/dockerfile:1

# --- deps: install from the lockfile (includes dev deps: tsx for the admin scripts) ---
FROM node:24-bookworm-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci

# --- builder: compile the Next.js app ---
FROM node:24-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are inlined at build time.
ARG NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
ARG NEXT_PUBLIC_PYTH_API_KEY=
ENV NEXT_PUBLIC_RPC_URL=${NEXT_PUBLIC_RPC_URL}
ENV NEXT_PUBLIC_PYTH_API_KEY=${NEXT_PUBLIC_PYTH_API_KEY}
RUN npm run build

# --- runner ---
FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    REGISTRY_PATH=/data/registry.json \
    FLAGSHIP_PATH=/data/flagship.json \
    KEYPAIR_PATH=/data/id.json

RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs --create-home nextjs \
 && mkdir -p /data && chown nextjs:nodejs /data

# Runtime needs node_modules + the build output + config + public assets.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts

# Admin scripts (seed / launch:flagship) so they can run as one-off containers.
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/src/idl ./src/idl
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/constants.ts ./src/lib/constants.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/flagship.ts ./src/lib/flagship.ts

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "exec ./node_modules/.bin/next start -H 0.0.0.0 -p ${PORT:-3000}"]
