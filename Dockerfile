# ═══════════════════════════════════════════════════════════════
# TaskFlow — Multi-Stage Dockerfile
# Runtime: Bun + Next.js 16 + SQLite
# ═══════════════════════════════════════════════════════════════

# ── Stage 1: Dependencies ─────────────────────────────────────
# Use a recent Bun image that understands lockfileVersion=1
# and fully-qualified name so Podman can resolve it.
FROM docker.io/oven/bun:1.3.11-alpine AS deps

LABEL stage="deps"

WORKDIR /app

# Copy package manifests
COPY package.json bun.lock* ./

# Install all dependencies (including dev — needed for build)
RUN bun install --frozen-lockfile


# ── Stage 2: Builder ──────────────────────────────────────────
FROM docker.io/oven/bun:1.3.11-alpine AS builder

LABEL stage="builder"

WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy full source
COPY . .

# Remove .env files to prevent baking secrets into image
RUN find . -name ".env*" -not -name ".env.example" -delete

# Generate Drizzle migrations (if not already committed)
# Ensure SQLite schema exists before `next build`, because build may
# execute server logic for API/route data collection.
RUN bun run db:migrate

# Build Next.js application
RUN bun --bun run build


# ── Stage 3: Production runner ────────────────────────────────
FROM docker.io/oven/bun:1.3.11-alpine AS runner

LABEL maintainer="TaskFlow" \
      version="2.0" \
      description="TaskFlow — intranet task management"

# Install tini for proper signal handling
RUN apk add --no-cache tini

WORKDIR /app

# Create non-root user and group
RUN addgroup -g 1001 -S taskflow && \
    adduser -S taskflow -u 1001 -G taskflow

# Create persistent data directory for SQLite
RUN mkdir -p /app/data && chown -R taskflow:taskflow /app/data

# Copy built application artifacts
COPY --from=builder --chown=taskflow:taskflow /app/.next ./.next
COPY --from=builder --chown=taskflow:taskflow /app/public ./public
COPY --from=builder --chown=taskflow:taskflow /app/node_modules ./node_modules
COPY --from=builder --chown=taskflow:taskflow /app/package.json ./package.json
COPY --from=builder --chown=taskflow:taskflow /app/next.config.ts ./next.config.ts

# Copy database schema, migrations, and seed files
COPY --from=builder --chown=taskflow:taskflow /app/drizzle ./drizzle
COPY --from=builder --chown=taskflow:taskflow /app/shared/db ./shared/db

# Copy remaining shared/entities/features needed at runtime
COPY --from=builder --chown=taskflow:taskflow /app/shared ./shared
COPY --from=builder --chown=taskflow:taskflow /app/entities ./entities
COPY --from=builder --chown=taskflow:taskflow /app/tsconfig.json ./tsconfig.json

# Copy entrypoint script
COPY --chown=taskflow:taskflow docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Ensure working directory (/app) is writable by the non-root user.
# This is needed because the entrypoint creates `/app/local.db` symlink.
RUN chown -R taskflow:taskflow /app

# Switch to non-root user
USER taskflow

# Expose application port
EXPOSE 3000

# Health check — waits for Next.js to respond
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget -qO- http://localhost:3000/api/health || exit 1

# Use tini as PID 1 for proper signal handling
ENTRYPOINT ["/sbin/tini", "--", "./docker-entrypoint.sh"]