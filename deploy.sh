#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# deploy.sh — TaskFlow deployment helper
# Usage: ./deploy.sh [command]
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

# ── Colors ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ── Config ────────────────────────────────────────────────────
APP_NAME="taskflow"
CONTAINER_NAME="taskflow_app"
IMAGE_NAME="taskflow:latest"
HOST_PORT="38701"
HOST_IP="192.168.99.101"
APP_URL="http://${HOST_IP}:${HOST_PORT}"
COMPOSE_FILE="docker-compose.yml"

# ── Helpers ───────────────────────────────────────────────────
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
banner()  {
  echo -e "${CYAN}"
  echo "╔══════════════════════════════════════════╗"
  echo "║        TaskFlow Deploy Helper            ║"
  echo "╚══════════════════════════════════════════╝"
  echo -e "${NC}"
}

check_deps() {
  command -v docker >/dev/null 2>&1 || error "Docker not found. Install Docker first."
  docker compose version >/dev/null 2>&1 || error "Docker Compose plugin not found."
  success "Docker $(docker --version | awk '{print $3}' | tr -d ',')"
  success "Docker Compose $(docker compose version --short)"
}

# ── Commands ──────────────────────────────────────────────────

cmd_build() {
  info "Building Docker image (this may take 3-5 minutes on first run)..."
  docker compose -f "$COMPOSE_FILE" build --no-cache
  success "Image built: ${IMAGE_NAME}"
}

cmd_up() {
  info "Starting TaskFlow..."
  docker compose -f "$COMPOSE_FILE" up -d
  info "Waiting for health check (up to 90 seconds)..."
  
  local attempts=0
  until docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null | grep -q "healthy"; do
    attempts=$((attempts + 1))
    if [ $attempts -gt 18 ]; then
      warn "Container not healthy yet. Checking logs..."
      docker logs --tail=30 "$CONTAINER_NAME"
      break
    fi
    printf "."
    sleep 5
  done
  echo ""
  success "TaskFlow is running!"
  echo -e "  ${GREEN}→ Open: ${APP_URL}${NC}"
  echo -e "  ${GREEN}→ Health: ${APP_URL}/api/health${NC}"
}

cmd_down() {
  info "Stopping TaskFlow..."
  docker compose -f "$COMPOSE_FILE" down
  success "Stopped."
}

cmd_restart() {
  cmd_down
  cmd_up
}

cmd_deploy() {
  banner
  check_deps
  info "Full deployment: build → up"
  cmd_build
  cmd_up
}

cmd_update() {
  banner
  check_deps
  info "Updating TaskFlow (rebuild without losing data)..."
  cmd_build
  docker compose -f "$COMPOSE_FILE" up -d --force-recreate
  success "Update complete. Data volume preserved."
}

cmd_logs() {
  docker compose -f "$COMPOSE_FILE" logs -f --tail=100
}

cmd_status() {
  banner
  echo -e "${BLUE}Container status:${NC}"
  docker compose -f "$COMPOSE_FILE" ps
  echo ""
  
  if docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
    local health
    health=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "unknown")
    echo -e "${BLUE}Health:${NC} ${health}"
    
    local started
    started=$(docker inspect --format='{{.State.StartedAt}}' "$CONTAINER_NAME" 2>/dev/null || echo "unknown")
    echo -e "${BLUE}Started:${NC} ${started}"
    
    echo ""
    echo -e "${BLUE}Resource usage:${NC}"
    docker stats "$CONTAINER_NAME" --no-stream --format "  CPU: {{.CPUPerc}}  MEM: {{.MemUsage}}" 2>/dev/null || true
  fi
  
  echo ""
  echo -e "${BLUE}App URL:${NC} ${APP_URL}"
  echo -e "${BLUE}Health:${NC} ${APP_URL}/api/health"
}

cmd_shell() {
  info "Opening shell in container..."
  docker exec -it "$CONTAINER_NAME" sh
}

cmd_db_backup() {
  local backup_file="taskflow_backup_$(date +%Y%m%d_%H%M%S).db"
  info "Backing up database to ${backup_file}..."
  docker exec "$CONTAINER_NAME" sh -c "sqlite3 /app/data/taskflow.db '.backup /tmp/backup.db'" 2>/dev/null || \
    docker exec "$CONTAINER_NAME" cp /app/data/taskflow.db /tmp/backup.db
  docker cp "${CONTAINER_NAME}:/tmp/backup.db" "./${backup_file}"
  success "Database backed up to: ${backup_file}"
}

cmd_db_seed() {
  info "Running database seed..."
  docker exec "$CONTAINER_NAME" bun run db:seed
  success "Seed complete."
}

cmd_reset_db() {
  warn "This will DELETE all data and re-seed the database!"
  read -r -p "Are you sure? (yes/no): " confirm
  if [ "$confirm" = "yes" ]; then
    docker exec "$CONTAINER_NAME" sh -c "rm -f /app/data/taskflow.db && rm -f /app/local.db"
    docker compose -f "$COMPOSE_FILE" restart
    success "Database reset. Container restarting with fresh seed."
  else
    info "Aborted."
  fi
}

cmd_cleanup() {
  warn "This will remove the container and image (NOT the data volume)."
  read -r -p "Continue? (yes/no): " confirm
  if [ "$confirm" = "yes" ]; then
    docker compose -f "$COMPOSE_FILE" down --rmi local
    success "Cleaned up. Data volume preserved."
  fi
}

cmd_help() {
  banner
  echo "Usage: $0 <command>"
  echo ""
  echo -e "${CYAN}Deployment:${NC}"
  echo "  deploy      — Full first-time deploy (build + start)"
  echo "  update      — Rebuild and redeploy, preserving data"
  echo "  build       — Only build the Docker image"
  echo "  up          — Start the app (image must be built)"
  echo "  down        — Stop the app"
  echo "  restart     — Stop then start"
  echo ""
  echo -e "${CYAN}Monitoring:${NC}"
  echo "  status      — Show container status and resource usage"
  echo "  logs        — Follow application logs"
  echo "  shell       — Open shell inside container"
  echo ""
  echo -e "${CYAN}Database:${NC}"
  echo "  db-backup   — Backup SQLite database to local file"
  echo "  db-seed     — Re-run seed script"
  echo "  reset-db    — ⚠️  Delete all data and re-seed"
  echo ""
  echo -e "${CYAN}Maintenance:${NC}"
  echo "  cleanup     — Remove container and image (keeps data)"
  echo "  help        — Show this help"
  echo ""
  echo -e "${BLUE}App URL:${NC} ${APP_URL}"
}

# ── Main ──────────────────────────────────────────────────────
case "${1:-help}" in
  deploy)    cmd_deploy    ;;
  update)    cmd_update    ;;
  build)     cmd_build     ;;
  up)        cmd_up        ;;
  down)      cmd_down      ;;
  restart)   cmd_restart   ;;
  status)    cmd_status    ;;
  logs)      cmd_logs      ;;
  shell)     cmd_shell     ;;
  db-backup) cmd_db_backup ;;
  db-seed)   cmd_db_seed   ;;
  reset-db)  cmd_reset_db  ;;
  cleanup)   cmd_cleanup   ;;
  help|*)    cmd_help      ;;
esac