#!/bin/sh
# ═══════════════════════════════════════════════════════════════
# docker-entrypoint.sh — TaskFlow container entrypoint
# Runs DB migrations, optionally seeds, then starts Next.js
# ═══════════════════════════════════════════════════════════════
set -e

echo "╔════════════════════════════════════════╗"
echo "║          TaskFlow — Starting up        ║"
echo "╚════════════════════════════════════════╝"

# ── Database path ──────────────────────────────────────────────
# DB lives in /app/data (Docker volume) so data persists across restarts
export DATABASE_URL="${DATABASE_URL:-/app/data/taskflow.db}"

# Symlink so the app finds local.db at the expected path
# (The app references ./local.db hardcoded in shared/db/client.ts)
if [ ! -L /app/local.db ]; then
  ln -sf /app/data/taskflow.db /app/local.db
  echo "✓ Linked /app/local.db → /app/data/taskflow.db"
fi

# ── Run Drizzle migrations ─────────────────────────────────────
echo "→ Running database migrations..."
bun run db:migrate
echo "✓ Migrations complete"

# ── Seed on first run ──────────────────────────────────────────
# Only seeds if DB is empty (no epics table data)
if [ "${SEED_ON_FIRST_RUN:-true}" = "true" ]; then
  RECORD_COUNT=$(bun -e "
    const { Database } = await import('bun:sqlite');
    const db = new Database('/app/data/taskflow.db');
    try {
      const r = db.query('SELECT COUNT(*) as c FROM epics').get();
      console.log(r.c);
    } catch {
      console.log('0');
    }
    db.close();
  " 2>/dev/null || echo "0")

  if [ "$RECORD_COUNT" = "0" ]; then
    echo "→ Empty database detected — running seed..."
    bun run db:seed
    echo "✓ Seed complete"
  else
    echo "✓ Database already has data (${RECORD_COUNT} epics) — skipping seed"
  fi
fi

# ── Start Next.js ──────────────────────────────────────────────
echo "→ Starting Next.js on port ${PORT:-3000}..."
echo "╔════════════════════════════════════════╗"
echo "║  TaskFlow is ready!                    ║"
echo "╚════════════════════════════════════════╝"

exec bun run start -- --port "${PORT:-3000}"