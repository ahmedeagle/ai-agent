#!/bin/bash
##############################################################################
# AI Call Center — Minimal AWS EC2 Deployment Script
# Run this on a fresh Ubuntu 22.04 EC2 instance (t3.xlarge / 4 vCPU, 16 GB)
# 
# Usage:
#   chmod +x aws-setup.sh
#   ./aws-setup.sh
##############################################################################

set -e

echo "=========================================="
echo " AI Call Center — Server Setup"
echo "=========================================="

# ---- 1. System Updates ----
echo "[1/6] Updating system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y

# ---- 2. Install Docker + Docker Compose ----
echo "[2/6] Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
fi

# Docker Compose plugin (V2)
sudo apt-get install -y docker-compose-plugin 2>/dev/null || true

# ---- 3. Install Node.js 20 (needed for Prisma migrations) ----
echo "[3/6] Installing Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# ---- 4. Install useful utilities ----
echo "[4/6] Installing utilities..."
sudo apt-get install -y git htop curl jq unzip

# ---- 5. Open firewall ports ----
echo "[5/6] Configuring firewall..."
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp     # Nginx / Frontend
sudo ufw allow 443/tcp    # HTTPS
sudo ufw allow 3000/tcp   # API Gateway
sudo ufw allow 3021/tcp   # Frontend (direct)
sudo ufw --force enable 2>/dev/null || true

# ---- 6. Create swap (useful for smaller instances) ----
echo "[6/6] Creating swap file..."
if [ ! -f /swapfile ]; then
    sudo fallocate -l 4G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

echo ""
echo "=========================================="
echo " Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Clone or copy your project to this server"
echo "  2. cd into the project directory"
echo "  3. Copy .env.production  →  .env  and fill in your keys"
echo "  4. Run:  ./deploy/start.sh"
echo ""
echo "NOTE: Log out and back in for Docker group changes to take effect."
