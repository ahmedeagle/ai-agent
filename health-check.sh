#!/bin/bash

# Service Health Check Script
# Run this after deployment to verify all services are working

echo "======================================"
echo "AI Call Center - Health Check"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get public IP
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "localhost")

echo "Server IP: $PUBLIC_IP"
echo ""

# Function to check endpoint
check_endpoint() {
    local name=$1
    local url=$2
    local response=$(curl -s -o /dev/null -w "%{http_code}" $url --max-time 5 2>/dev/null)
    
    if [ "$response" == "200" ] || [ "$response" == "201" ]; then
        echo -e "${GREEN}✓${NC} $name - OK"
        return 0
    else
        echo -e "${RED}✗${NC} $name - FAILED (HTTP $response)"
        return 1
    fi
}

# Check Docker
echo "Checking Docker..."
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓${NC} Docker installed"
else
    echo -e "${RED}✗${NC} Docker not installed"
    exit 1
fi

# Check Docker Compose
if command -v docker-compose &> /dev/null; then
    echo -e "${GREEN}✓${NC} Docker Compose installed"
else
    echo -e "${RED}✗${NC} Docker Compose not installed"
    exit 1
fi

echo ""
echo "Checking Containers..."

# Count running containers
RUNNING=$(docker ps --format "{{.Names}}" | wc -l)
echo "Running containers: $RUNNING"

if [ $RUNNING -lt 20 ]; then
    echo -e "${YELLOW}⚠${NC} Warning: Expected 20+ containers, found $RUNNING"
fi

echo ""
echo "Checking Core Services..."

# Check databases
check_endpoint "PostgreSQL" "http://localhost:5432" || echo -e "${YELLOW}  (DB port check)${NC}"
check_endpoint "Redis" "http://localhost:6379" || echo -e "${YELLOW}  (Redis port check)${NC}"
check_endpoint "MongoDB" "http://localhost:27017" || echo -e "${YELLOW}  (MongoDB port check)${NC}"

echo ""
echo "Checking Microservices..."

# Infrastructure
check_endpoint "API Gateway" "http://localhost:3001/health"

# Core Services
check_endpoint "Voice Service" "http://localhost:3002/health"
check_endpoint "AI Runtime" "http://localhost:3003/health"
check_endpoint "Tool Service" "http://localhost:3004/health"
check_endpoint "Recording Service" "http://localhost:3005/health"
check_endpoint "Transcript Service" "http://localhost:3006/health"
check_endpoint "Analytics Service" "http://localhost:3007/health"
check_endpoint "QA Service" "http://localhost:3008/health"
check_endpoint "Auth Service" "http://localhost:3009/health"
check_endpoint "Company Service" "http://localhost:3010/health"

# Advanced Services
check_endpoint "Transfer Service" "http://localhost:3011/health"
check_endpoint "IVR Service" "http://localhost:3012/health"
check_endpoint "SMS Service" "http://localhost:3013/health"
check_endpoint "Sentiment Service" "http://localhost:3014/health"
check_endpoint "Email Service" "http://localhost:3015/health"
check_endpoint "WhatsApp Service" "http://localhost:3016/health"
check_endpoint "Billing Service" "http://localhost:3017/health"
check_endpoint "Campaign Service" "http://localhost:3018/health"
check_endpoint "Voicemail Service" "http://localhost:3019/health"
check_endpoint "Queue Service" "http://localhost:3020/health"
check_endpoint "Monitoring Service" "http://localhost:3021/health"
check_endpoint "Survey Service" "http://localhost:3022/health"

echo ""
echo "Checking Frontend..."
check_endpoint "Frontend" "http://localhost:3000"

echo ""
echo "======================================"
echo "System Status Summary"
echo "======================================"

# Check if .env exists
if [ -f ".env" ]; then
    echo -e "${GREEN}✓${NC} .env file configured"
    
    # Check for API keys (without showing values)
    if grep -q "OPENAI_API_KEY=\"sk-" .env; then
        echo -e "${GREEN}✓${NC} OpenAI API key configured"
    else
        echo -e "${RED}✗${NC} OpenAI API key missing"
    fi
    
    if grep -q "DEEPGRAM_API_KEY" .env && ! grep -q "DEEPGRAM_API_KEY=\"xxxxx\"" .env; then
        echo -e "${GREEN}✓${NC} Deepgram API key configured"
    else
        echo -e "${RED}✗${NC} Deepgram API key missing"
    fi
    
    if grep -q "ELEVENLABS_API_KEY" .env && ! grep -q "ELEVENLABS_API_KEY=\"xxxxx\"" .env; then
        echo -e "${GREEN}✓${NC} ElevenLabs API key configured"
    else
        echo -e "${RED}✗${NC} ElevenLabs API key missing"
    fi
    
    if grep -q "TWILIO_ACCOUNT_SID=\"AC" .env; then
        echo -e "${GREEN}✓${NC} Twilio credentials configured"
    else
        echo -e "${RED}✗${NC} Twilio credentials missing"
    fi
else
    echo -e "${RED}✗${NC} .env file not found"
fi

echo ""
echo "Access URLs:"
echo "  Frontend:    http://$PUBLIC_IP:3000"
echo "  API Gateway: http://$PUBLIC_IP:3001"
echo ""
echo "Twilio Webhooks (configure in Twilio Console):"
echo "  Voice Incoming: http://$PUBLIC_IP:3001/api/webhook/voice/incoming"
echo "  Voice Status:   http://$PUBLIC_IP:3001/api/voice/status"
echo "  Recording:      http://$PUBLIC_IP:3001/api/voice/recording"
echo ""

# Check resource usage
echo "Resource Usage:"
echo "Memory: $(free -h | awk '/^Mem:/ {print $3 "/" $2}')"
echo "Disk:   $(df -h / | awk 'NR==2 {print $3 "/" $2 " (" $5 " used)"}')"
echo ""

# Show problematic containers
echo "Container Status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | head -n 10
echo "... (showing first 10 containers)"
echo ""

# Show any failed containers
FAILED=$(docker ps -a --filter "status=exited" --format "{{.Names}}" | wc -l)
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}⚠ Warning: $FAILED container(s) have exited${NC}"
    docker ps -a --filter "status=exited" --format "table {{.Names}}\t{{.Status}}"
    echo ""
    echo "Check logs with: docker-compose logs container-name"
fi

echo "======================================"
echo "Health check complete!"
echo "======================================"
