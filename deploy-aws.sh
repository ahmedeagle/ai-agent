#!/bin/bash

# AI Call Center - AWS EC2 Quick Deployment Script
# Run this script on your AWS EC2 Ubuntu instance

set -e  # Exit on error

echo "=========================================="
echo "AI Call Center - AWS Deployment"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    echo -e "${RED}Please do not run as root. Run as ubuntu user.${NC}"
    exit 1
fi

# Step 1: Update system
echo -e "${GREEN}[1/8] Updating system packages...${NC}"
sudo apt update && sudo apt upgrade -y

# Step 2: Install Docker
echo -e "${GREEN}[2/8] Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo -e "${YELLOW}Docker installed. Please logout and login again, then re-run this script.${NC}"
    exit 0
else
    echo "Docker already installed"
fi

# Step 3: Install Docker Compose
echo -e "${GREEN}[3/8] Installing Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi
docker-compose --version

# Step 4: Install Node.js
echo -e "${GREEN}[4/8] Installing Node.js 20...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
node --version
npm --version

# Step 5: Check for project files
echo -e "${GREEN}[5/8] Checking project files...${NC}"
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}Error: docker-compose.yml not found!${NC}"
    echo "Please run this script from the AIAgent project root directory."
    exit 1
fi

# Step 6: Configure environment
echo -e "${GREEN}[6/8] Configuring environment...${NC}"
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${YELLOW}Created .env file from .env.example${NC}"
        echo -e "${YELLOW}IMPORTANT: Edit .env file and add your API keys before continuing!${NC}"
        echo ""
        echo "Required API keys:"
        echo "  - OPENAI_API_KEY"
        echo "  - DEEPGRAM_API_KEY"
        echo "  - ELEVENLABS_API_KEY"
        echo "  - TWILIO_ACCOUNT_SID"
        echo "  - TWILIO_AUTH_TOKEN"
        echo "  - TWILIO_PHONE_NUMBER"
        echo ""
        read -p "Press Enter after you've updated .env file..."
    else
        echo -e "${RED}Error: .env.example not found!${NC}"
        exit 1
    fi
fi

# Step 7: Setup database
echo -e "${GREEN}[7/8] Setting up database...${NC}"
cd packages/database

# Install dependencies
if [ ! -d "node_modules" ]; then
    echo "Installing database dependencies..."
    npm install
fi

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Start database services
cd ../..
echo "Starting database services..."
docker-compose up -d postgres mongodb redis rabbitmq elasticsearch

# Wait for databases to be ready
echo "Waiting for databases to initialize (30 seconds)..."
sleep 30

# Push schema
echo "Pushing database schema..."
cd packages/database
npx prisma db push --accept-data-loss

# Seed database (optional)
if [ -f "prisma/seed.ts" ]; then
    echo "Seeding database with initial data..."
    npx prisma db seed || echo "Seed script not found or failed"
fi

cd ../..

# Step 8: Build and deploy
echo -e "${GREEN}[8/8] Building and deploying all services...${NC}"
echo "This will take 10-15 minutes..."

# Build all images
docker-compose build

# Start all services
docker-compose up -d

# Wait a bit for services to start
sleep 10

# Check status
echo ""
echo "=========================================="
echo -e "${GREEN}Deployment Complete!${NC}"
echo "=========================================="
echo ""

# Get EC2 public IP
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 || echo "UNKNOWN")

echo "Service Status:"
docker-compose ps

echo ""
echo "Access your platform:"
echo "  Frontend:    http://$PUBLIC_IP:3000"
echo "  API Gateway: http://$PUBLIC_IP:3001"
echo ""
echo "Health Check:"
curl -s http://localhost:3001/health && echo "" || echo "API Gateway not ready yet, wait 1-2 minutes"
echo ""
echo "View logs with: docker-compose logs -f"
echo "Stop services:  docker-compose down"
echo ""
echo -e "${YELLOW}Don't forget to configure Twilio webhooks:${NC}"
echo "  Voice Incoming: http://$PUBLIC_IP:3001/api/webhook/voice/incoming"
echo "  Voice Status:   http://$PUBLIC_IP:3001/api/voice/status"
echo "  Recording:      http://$PUBLIC_IP:3001/api/voice/recording"
echo ""
echo "=========================================="
echo -e "${GREEN}Happy Testing! 🚀${NC}"
echo "=========================================="
