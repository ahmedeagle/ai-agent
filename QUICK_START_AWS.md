# AWS Quick Start Commands

## 📋 Pre-Deployment Checklist

✅ AWS EC2 instance launched (Ubuntu 22.04, t3.xlarge or larger)
✅ Security group configured (ports 22, 80, 443, 3000, 3001 open)
✅ SSH key downloaded (.pem file)
✅ Have your API keys ready:
   - OpenAI API key
   - Deepgram API key
   - ElevenLabs API key
   - Twilio credentials

---

## 🚀 Quick Deploy (3 Commands)

### Step 1: Connect to EC2
```bash
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

### Step 2: Upload Project to EC2

**Option A: From Git Repository (Recommended)**
```bash
git clone YOUR_REPO_URL AIAgent
cd AIAgent
```

**Option B: Transfer from Local Machine**
```powershell
# On your Windows machine (PowerShell):
scp -i your-key.pem -r C:\Users\lenovo\Downloads\AIAgent ubuntu@YOUR_EC2_PUBLIC_IP:/home/ubuntu/

# Then on EC2:
cd /home/ubuntu/AIAgent
```

### Step 3: Run Automated Deployment
```bash
chmod +x deploy-aws.sh
./deploy-aws.sh
```

The script will:
- Install Docker & Docker Compose
- Install Node.js
- Setup databases
- Build all services
- Deploy everything
- Show you the access URLs

⏱️ **Total Time: ~15 minutes**

---

## 🔑 Configure API Keys

Before deployment completes, edit `.env`:

```bash
nano .env
```

**Required changes:**
```env
# Your EC2 Public IP or Domain
FRONTEND_URL="http://YOUR_EC2_PUBLIC_IP:3000"
API_URL="http://YOUR_EC2_PUBLIC_IP:3001"

# Add your API keys
OPENAI_API_KEY="sk-proj-xxxxx"
DEEPGRAM_API_KEY="xxxxx"
ELEVENLABS_API_KEY="xxxxx"

# Twilio credentials
TWILIO_ACCOUNT_SID="ACxxxxx"
TWILIO_AUTH_TOKEN="xxxxx"
TWILIO_PHONE_NUMBER="+1234567890"

# Change JWT secret
JWT_SECRET="generate-a-random-secure-string-here"
```

Save: `Ctrl+X` → `Y` → `Enter`

---

## ✅ Verify Deployment

```bash
# Check all containers are running
docker ps

# You should see 20+ containers

# Check API health
curl http://localhost:3001/health

# View logs
docker-compose logs -f
```

---

## 🌐 Access Your Platform

**Frontend Dashboard:**
```
http://YOUR_EC2_PUBLIC_IP:3000
```

**API Gateway:**
```
http://YOUR_EC2_PUBLIC_IP:3001
```

**Default Admin Login** (if seeded):
- Email: admin@example.com
- Password: (check seed file or create new account)

---

## 📞 Configure Twilio Webhooks

1. Go to: https://console.twilio.com/
2. Navigate to: Phone Numbers → Active Numbers → Select your number
3. Configure webhooks:

**Voice Configuration:**
- A CALL COMES IN: `http://YOUR_EC2_PUBLIC_IP:3001/api/webhook/voice/incoming`
- METHOD: POST

**Status Callback:**
- Primary Handler Fails: `http://YOUR_EC2_PUBLIC_IP:3001/api/voice/status`
- METHOD: POST

**Recording Status:**
- Recording Status Callback: `http://YOUR_EC2_PUBLIC_IP:3001/api/voice/recording`
- METHOD: POST

4. Click **Save**

---

## 🧪 Test Your Deployment

### 1. Test API Gateway
```bash
curl http://YOUR_EC2_PUBLIC_IP:3001/health
```
Should return: `{"status":"ok"}`

### 2. Test Frontend
Open browser: `http://YOUR_EC2_PUBLIC_IP:3000`

### 3. Test Database Connection
```bash
docker exec -it $(docker ps -qf "name=postgres") psql -U postgres -d callcenter -c "SELECT COUNT(*) FROM companies;"
```

### 4. Test AI Services
```bash
# Check voice service
curl http://localhost:3002/health

# Check AI runtime
curl http://localhost:3003/health
```

### 5. Make a Test Call
1. Login to dashboard
2. Create a company account
3. Add a billing plan
4. Create an AI agent
5. Call your Twilio number
6. Monitor the call in dashboard

---

## 🔧 Common Commands

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f voice-service
docker-compose logs -f ai-runtime-service
docker-compose logs -f frontend

# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart voice-service

# Stop all services
docker-compose down

# Start all services
docker-compose up -d

# Rebuild a service
docker-compose build voice-service
docker-compose up -d voice-service

# Check resource usage
docker stats

# Access PostgreSQL
docker exec -it $(docker ps -qf "name=postgres") psql -U postgres -d callcenter

# Access MongoDB
docker exec -it $(docker ps -qf "name=mongodb") mongosh callcenter

# Check disk space
df -h

# Check memory
free -h
```

---

## 🛠️ Troubleshooting

### Services won't start?
```bash
# Check logs
docker-compose logs

# Rebuild without cache
docker-compose build --no-cache
docker-compose up -d
```

### Database connection errors?
```bash
# Restart database
docker-compose restart postgres

# Check if database is running
docker ps | grep postgres
```

### Out of memory?
```bash
# Check memory usage
free -h

# Upgrade to larger instance: t3.2xlarge (32 GB RAM)
```

### Port already in use?
```bash
# Find process
sudo lsof -i :3000

# Kill process
sudo kill -9 PID
```

---

## 📊 Monitor Your Services

```bash
# Real-time container stats
docker stats

# Check running containers
docker ps

# Check container logs (last 100 lines)
docker-compose logs --tail=100 service-name

# Follow logs in real-time
docker-compose logs -f service-name

# Check all service health
for port in 3002 3003 3004 3005 3006 3007 3008 3009; do
  echo "Port $port: $(curl -s http://localhost:$port/health || echo 'Not responding')"
done
```

---

## 🔄 Update & Redeploy

```bash
cd /home/ubuntu/AIAgent

# Pull latest changes
git pull

# Rebuild and restart
docker-compose build
docker-compose up -d

# Or rebuild specific service
docker-compose build voice-service
docker-compose up -d voice-service
```

---

## 💾 Backup Database

```bash
# Backup PostgreSQL
docker exec -t $(docker ps -qf "name=postgres") pg_dump -U postgres callcenter > backup_$(date +%Y%m%d_%H%M%S).sql

# Download to local machine
scp -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP:/home/ubuntu/backup_*.sql ./

# Restore from backup
cat backup_20260307_120000.sql | docker exec -i $(docker ps -qf "name=postgres") psql -U postgres -d callcenter
```

---

## 💰 Cost Optimization

**To save money when not testing:**

```bash
# Stop all services but keep containers
docker-compose stop

# Start again when needed
docker-compose start
```

**Stop EC2 instance:**
- Go to AWS Console → EC2 → Instances
- Right-click your instance → Instance State → Stop
- Start it again when needed
- **Note:** Your data persists, but IP may change

**Use Elastic IP (Recommended):**
- Allocate an Elastic IP in AWS Console
- Associate it with your EC2 instance
- IP won't change when you stop/start instance

---

## 🎯 Production Ready Upgrades

When ready for production:

```bash
# 1. Setup domain + SSL
sudo apt install nginx certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com

# 2. Update environment
nano .env
# Change to:
# FRONTEND_URL="https://yourdomain.com"
# API_URL="https://api.yourdomain.com"
# NODE_ENV="production"

# 3. Restart services
docker-compose restart

# 4. Enable automatic SSL renewal
sudo systemctl enable certbot.timer
```

---

## 📞 Support

**Check logs first:**
```bash
docker-compose logs -f
```

**Common issues:**
- API keys not configured → Edit `.env`
- Services not starting → Check `docker-compose logs`
- Can't connect → Check security group ports
- Twilio not working → Verify webhook URLs

**Useful AWS CLI commands:**
```bash
# Get instance public IP
curl http://169.254.169.254/latest/meta-data/public-ipv4

# Get instance metadata
curl http://169.254.169.254/latest/meta-data/
```

---

## ✅ Deployment Success Checklist

- [ ] EC2 instance created and accessible via SSH
- [ ] Project files on EC2
- [ ] Docker & Docker Compose installed
- [ ] `.env` file configured with all API keys
- [ ] Database schema pushed (`prisma db push` completed)
- [ ] All services built (`docker-compose build` completed)
- [ ] All containers running (`docker ps` shows 20+ containers)
- [ ] API Gateway health check passes
- [ ] Frontend accessible in browser
- [ ] Twilio webhooks configured
- [ ] Test call completed successfully
- [ ] Dashboard showing real-time data

🎉 **You're live on AWS!**
