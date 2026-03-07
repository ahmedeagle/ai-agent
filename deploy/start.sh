#!/bin/bash
##############################################################################
# Start all services with Docker Compose
# Usage:  ./deploy/start.sh
##############################################################################
set -e

cd "$(dirname "$0")/.."
PROJECT_ROOT=$(pwd)

echo "=========================================="
echo " AI Call Center — Starting Services"
echo "=========================================="

# Check .env exists
if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    echo "Copy .env.production to .env and fill in your API keys."
    echo "  cp .env.production .env"
    exit 1
fi

# ---- Step 1: Pull & Build ----
echo "[1/4] Building Docker images (one at a time to save memory)..."

SERVICES=(
  api-gateway
  admin-service
  voice-service
  tool-execution-service
  recording-service
  ai-engine-service
  analytics-service
  qa-service
  knowledge-base-service
  transfer-service
  ivr-service
  sms-service
  sentiment-service
  email-service
  whatsapp-service
  billing-service
  campaigns-service
  voicemail-service
  queue-service
  monitoring-service
  survey-service
  frontend
)

for svc in "${SERVICES[@]}"; do
  echo "  Building $svc..."
  docker compose build "$svc" 2>&1 | tail -1
done
echo "All images built."

# ---- Step 2: Start infrastructure first ----
echo "[2/4] Starting databases & message queue..."
docker compose up -d postgres redis rabbitmq mongodb
echo "Waiting 15 seconds for databases to initialize..."
sleep 15

# ---- Step 3: Run Prisma migrations ----
echo "[3/4] Running database migrations..."
# Override DATABASE_URL to use localhost (host runs prisma, not Docker)
export $(grep -v '^#' .env | xargs)
export DATABASE_URL="postgresql://user:password@localhost:5432/ai_agent_db"

cd packages/database
npx prisma generate 2>/dev/null || npm install prisma @prisma/client && npx prisma generate
npx prisma db push --accept-data-loss
cd "$PROJECT_ROOT"

echo "Database schema synced."

# ---- Step 4: Start all services ----
echo "[4/4] Starting all application services..."
docker compose up -d

echo ""
echo "=========================================="
echo " All Services Running!"
echo "=========================================="
echo ""
echo " Frontend:     http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_IP'):3021"
echo " API Gateway:  http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_IP'):3000"
echo " RabbitMQ UI:  http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_IP'):15672"
echo ""
echo " View logs:    docker compose logs -f"
echo " Stop all:     docker compose down"
echo " Restart:      docker compose restart"
echo ""
