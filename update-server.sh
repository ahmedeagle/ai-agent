#!/bin/bash
# Auto-update script for EC2 server
set -e

echo "=========================================="
echo "Updating AI Agent on EC2 Server"
echo "=========================================="

cd /home/ubuntu/AIAgent || cd ~/AIAgent || { echo "Project directory not found!"; exit 1; }

echo "[1/5] Pulling latest code from GitHub..."
git pull origin main

echo "[2/5] Rebuilding API Gateway..."
docker-compose up -d --build api-gateway

echo "[3/5] Fixing existing user roles in database..."
docker exec -i $(docker ps -q -f name=postgres) psql -U user -d ai_agent_db <<EOF
UPDATE "User" SET role = 'admin' WHERE role = 'ADMIN';
UPDATE "User" SET role = 'supervisor' WHERE role = 'SUPERVISOR';
UPDATE "User" SET role = 'agent' WHERE role = 'AGENT';
UPDATE "User" SET role = 'viewer' WHERE role = 'VIEWER';
SELECT email, role FROM "User";
EOF

echo "[4/5] Restarting API Gateway to apply changes..."
docker-compose restart api-gateway

echo "[5/5] Verifying services..."
docker-compose ps | grep api-gateway

echo ""
echo "=========================================="
echo "✓ Update Complete!"
echo "=========================================="
echo "Please log out and log back in to get a fresh token."
