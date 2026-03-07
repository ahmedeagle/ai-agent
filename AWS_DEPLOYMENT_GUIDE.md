# AWS Deployment Guide (Dev/Test)

## 🚀 Simple EC2 Deployment with Docker Compose

This guide will help you deploy the entire platform on AWS EC2 for development and testing.

---

## Step 1: Launch EC2 Instance

### Instance Configuration:
```
AMI: Ubuntu 22.04 LTS (Free Tier eligible)
Instance Type: t3.xlarge (4 vCPU, 16 GB RAM) - Recommended for dev/test
              OR t3.2xlarge (8 vCPU, 32 GB RAM) - For production-like testing
Storage: 50 GB GP3 SSD (increase if you need more recording storage)
```

### Security Group Rules:
Open these ports:
```
SSH:           22     (Your IP only)
HTTP:          80     (0.0.0.0/0)
HTTPS:         443    (0.0.0.0/0)
PostgreSQL:    5432   (Your IP only - for DB access)
Frontend:      3000   (0.0.0.0/0 - if not using reverse proxy)
API Gateway:   3001   (0.0.0.0/0)
```

---

## Step 2: Connect to EC2 Instance

```bash
# From your local machine
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP

# Update system
sudo apt update && sudo apt upgrade -y
```

---

## Step 3: Install Docker & Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add ubuntu user to docker group
sudo usermod -aG docker ubuntu

# Logout and login again for group changes to take effect
exit
# SSH back in

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

---

## Step 4: Install Node.js & npm (for Prisma CLI)

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version
npm --version
```

---

## Step 5: Transfer Project Files to EC2

### Option A: Using Git (Recommended)
```bash
# On EC2 instance
cd /home/ubuntu
git clone YOUR_REPOSITORY_URL AIAgent
cd AIAgent
```

### Option B: Using SCP (from local machine)
```bash
# Compress project (on Windows)
# In PowerShell:
cd C:\Users\lenovo\Downloads
Compress-Archive -Path AIAgent -DestinationPath AIAgent.zip

# Transfer to EC2
scp -i your-key.pem AIAgent.zip ubuntu@YOUR_EC2_PUBLIC_IP:/home/ubuntu/

# On EC2, extract
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
cd /home/ubuntu
sudo apt install unzip -y
unzip AIAgent.zip
cd AIAgent
```

---

## Step 6: Configure Environment Variables

```bash
cd /home/ubuntu/AIAgent

# Copy environment template
cp .env.example .env

# Edit .env file
nano .env
```

### **CRITICAL: Update these values in .env:**

```env
# ============================================
# DATABASE CONFIGURATION
# ============================================
DATABASE_URL="postgresql://postgres:your_secure_password_here@postgres:5432/callcenter?schema=public"
MONGODB_URL="mongodb://mongodb:27017/callcenter"
REDIS_URL="redis://redis:6379"
RABBITMQ_URL="amqp://guest:guest@rabbitmq:5672"
ELASTICSEARCH_URL="http://elasticsearch:9200"

# ============================================
# AWS EC2 URLS (Replace with your EC2 Public IP or Domain)
# ============================================
FRONTEND_URL="http://YOUR_EC2_PUBLIC_IP:3000"
API_URL="http://YOUR_EC2_PUBLIC_IP:3001"

# If you have a domain:
# FRONTEND_URL="https://yourdomain.com"
# API_URL="https://api.yourdomain.com"

# ============================================
# API KEYS - ADD YOUR REAL KEYS HERE
# ============================================
OPENAI_API_KEY="sk-proj-xxxxx"          # Get from: https://platform.openai.com/api-keys
DEEPGRAM_API_KEY="xxxxx"                 # Get from: https://console.deepgram.com/
ELEVENLABS_API_KEY="xxxxx"               # Get from: https://elevenlabs.io/api

# ============================================
# TWILIO CREDENTIALS
# ============================================
TWILIO_ACCOUNT_SID="ACxxxxx"             # Get from: https://console.twilio.com/
TWILIO_AUTH_TOKEN="xxxxx"
TWILIO_PHONE_NUMBER="+1234567890"

# ============================================
# JWT SECRET (Change this to random string)
# ============================================
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"

# ============================================
# STRIPE (Optional - for payment processing)
# ============================================
STRIPE_SECRET_KEY="sk_test_xxxxx"        # Get from: https://dashboard.stripe.com/apikeys
STRIPE_PUBLISHABLE_KEY="pk_test_xxxxx"
STRIPE_WEBHOOK_SECRET="whsec_xxxxx"

# ============================================
# SMTP EMAIL (Optional - for notifications)
# ============================================
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# ============================================
# NODE ENVIRONMENT
# ============================================
NODE_ENV="development"
```

Save and exit (`Ctrl+X`, then `Y`, then `Enter`)

---

## Step 7: Setup Database Schema

```bash
cd /home/ubuntu/AIAgent/packages/database

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Start only database services first
cd /home/ubuntu/AIAgent
docker-compose up -d postgres mongodb redis rabbitmq elasticsearch

# Wait 30 seconds for databases to initialize
sleep 30

# Push schema to database
cd packages/database
npx prisma db push

# Seed database with initial data (optional)
npx prisma db seed
```

---

## Step 8: Build & Deploy All Services

```bash
cd /home/ubuntu/AIAgent

# Build all Docker images (this takes 10-15 minutes)
docker-compose build

# Start all services
docker-compose up -d

# Check if all services are running
docker-compose ps

# View logs (optional)
docker-compose logs -f

# Check specific service logs
docker-compose logs -f api-gateway
docker-compose logs -f frontend
```

---

## Step 9: Verify Deployment

### Check Service Health:
```bash
# API Gateway
curl http://localhost:3001/health

# Frontend (from browser)
# Visit: http://YOUR_EC2_PUBLIC_IP:3000

# Check all running containers
docker ps

# You should see 20+ containers running
```

### Access the Platform:
1. **Frontend Dashboard**: `http://YOUR_EC2_PUBLIC_IP:3000`
2. **API Gateway**: `http://YOUR_EC2_PUBLIC_IP:3001`
3. **Login**: Use seeded admin credentials or create new account

---

## Step 10: Configure Twilio Webhooks

Once deployed, configure these webhook URLs in your [Twilio Console](https://console.twilio.com/):

```
Voice Incoming Webhook:
http://YOUR_EC2_PUBLIC_IP:3001/api/webhook/voice/incoming

Voice Status Callback:
http://YOUR_EC2_PUBLIC_IP:3001/api/voice/status

Recording Status Callback:
http://YOUR_EC2_PUBLIC_IP:3001/api/voice/recording
```

**Note**: Twilio requires publicly accessible URLs. Make sure port 3001 is open in your security group.

---

## 🔒 Optional: Setup Domain + SSL (Production-Ready)

### A. Point Domain to EC2:
1. Go to your domain registrar (Namecheap, GoDaddy, etc.)
2. Add A record: `yourdomain.com` → `YOUR_EC2_ELASTIC_IP`
3. Add A record: `api.yourdomain.com` → `YOUR_EC2_ELASTIC_IP`

### B. Install Nginx Reverse Proxy:
```bash
sudo apt install nginx -y

# Configure Nginx
sudo nano /etc/nginx/sites-available/callcenter
```

Add this configuration:
```nginx
# Frontend
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# API Gateway
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/callcenter /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### C. Install SSL Certificate (Let's Encrypt):
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificates
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com

# Certificates auto-renew every 90 days
```

### D. Update .env with HTTPS URLs:
```bash
nano /home/ubuntu/AIAgent/.env

# Update these lines:
FRONTEND_URL="https://yourdomain.com"
API_URL="https://api.yourdomain.com"

# Restart services
cd /home/ubuntu/AIAgent
docker-compose restart
```

---

## 📊 Monitoring & Maintenance

### View Service Logs:
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f voice-service
docker-compose logs -f ai-runtime-service
docker-compose logs -f api-gateway
```

### Restart Services:
```bash
# All services
docker-compose restart

# Specific service
docker-compose restart voice-service
```

### Stop All Services:
```bash
docker-compose down
```

### Update Code & Redeploy:
```bash
cd /home/ubuntu/AIAgent

# Pull latest code
git pull

# Rebuild changed services
docker-compose build

# Restart services
docker-compose up -d
```

### Database Backup:
```bash
# Backup PostgreSQL
docker exec -t $(docker ps -qf "name=postgres") pg_dump -U postgres callcenter > backup_$(date +%Y%m%d).sql

# Backup MongoDB
docker exec $(docker ps -qf "name=mongodb") mongodump --out=/backup
docker cp $(docker ps -qf "name=mongodb"):/backup ./mongodb_backup_$(date +%Y%m%d)
```

---

## 💰 AWS Cost Estimation (Monthly)

### Dev/Test Environment:
```
EC2 t3.xlarge:        ~$120/month
50 GB GP3 Storage:    ~$5/month
Data Transfer (50GB): ~$5/month
Elastic IP:           Free (if attached)
----------------------------------
Total:                ~$130/month
```

### Cost Optimization Tips:
1. **Use EC2 Savings Plans**: Save 30-70%
2. **Stop instance when not testing**: Right-click → Instance State → Stop
3. **Use Spot Instances**: Save up to 90% (but can be terminated)
4. **Delete unused snapshots/volumes**

---

## 🔍 Troubleshooting

### Issue: Container fails to start
```bash
# Check logs
docker-compose logs service-name

# Rebuild without cache
docker-compose build --no-cache service-name
docker-compose up -d
```

### Issue: Database connection failed
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check database logs
docker-compose logs postgres

# Restart database
docker-compose restart postgres
```

### Issue: Out of memory
```bash
# Check memory usage
free -h
docker stats

# Solution: Upgrade to larger instance type (t3.2xlarge)
```

### Issue: Port already in use
```bash
# Find process using port
sudo lsof -i :3000

# Kill process
sudo kill -9 PROCESS_ID

# Or change port in docker-compose.yml
```

---

## 🎯 Quick Commands Cheat Sheet

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# Restart service
docker-compose restart service-name

# Rebuild service
docker-compose build service-name

# Check running containers
docker ps

# Check service health
curl http://localhost:3001/health

# Access database
docker exec -it $(docker ps -qf "name=postgres") psql -U postgres -d callcenter

# Update Prisma schema
cd packages/database && npx prisma db push

# View system resources
docker stats
```

---

## ✅ Final Verification Checklist

- [ ] EC2 instance running
- [ ] Security group ports open (80, 443, 3000, 3001)
- [ ] Docker & Docker Compose installed
- [ ] Project files on EC2
- [ ] .env file configured with API keys
- [ ] Database schema pushed (`prisma db push`)
- [ ] All containers running (`docker ps` shows 20+ containers)
- [ ] Frontend accessible: `http://YOUR_EC2_PUBLIC_IP:3000`
- [ ] API Gateway healthy: `http://YOUR_EC2_PUBLIC_IP:3001/health`
- [ ] Twilio webhooks configured
- [ ] Can login to dashboard
- [ ] Can create test agent
- [ ] Can make test call

---

## 📞 Test Your Deployment

1. **Login to Dashboard**: `http://YOUR_EC2_PUBLIC_IP:3000`
2. **Create Company Account**
3. **Add Billing Plan** (50 hours for $500)
4. **Create AI Agent**
5. **Configure Agent Tools** (Knowledge Base, CRM integration)
6. **Test Inbound Call**: Call your Twilio number
7. **Test Outbound Campaign**: Create campaign and start auto-dialer
8. **Monitor Dashboard**: View real-time call metrics
9. **Test Supervisor Features**: Listen/Whisper/Barge on live calls
10. **Check Billing**: Verify concurrent agent charges

---

## 🚀 You're Live!

Your AI call center platform is now running on AWS. Monitor the logs and adjust resources as needed.

For production deployment, consider:
- Using RDS for PostgreSQL (managed database)
- Using ElastiCache for Redis (managed cache)
- Using Amazon MQ for RabbitMQ (managed message queue)
- Setting up Auto Scaling Groups
- Using Application Load Balancer
- Implementing CloudWatch monitoring
- Setting up automated backups
- Using AWS Secrets Manager for API keys

**Need help?** Check logs: `docker-compose logs -f`
