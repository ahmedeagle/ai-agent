# 🔧 AWS Deployment Troubleshooting Guide

## Quick Diagnostics

Run this first to identify issues:
```bash
./health-check.sh
```

If that doesn't exist or fails:
```bash
docker ps                          # Check running containers
docker-compose logs -f             # View all logs
curl http://localhost:3001/health  # Test API
free -h                            # Check memory
df -h                              # Check disk space
```

---

## Common Issues & Solutions

### 🔴 Issue: Cannot SSH into EC2

**Symptoms:**
- Connection timeout
- Permission denied

**Solutions:**

1. **Check Security Group**
   ```
   AWS Console → EC2 → Security Groups
   Verify rule exists:
     Type: SSH
     Protocol: TCP
     Port: 22
     Source: Your IP or 0.0.0.0/0
   ```

2. **Fix Key Permissions** (Windows)
   ```powershell
   # Right-click your-key.pem → Properties → Security
   # Remove all users except yourself
   # Or use WSL/Git Bash:
   chmod 400 your-key.pem
   ```

3. **Check Instance State**
   ```
   AWS Console → EC2 → Instances
   State should be: "Running" (green dot)
   If stopped, right-click → Start Instance
   ```

4. **Verify Username**
   ```bash
   # Ubuntu AMI uses 'ubuntu' user
   ssh -i your-key.pem ubuntu@YOUR_EC2_IP
   
   # NOT 'ec2-user' (that's for Amazon Linux)
   ```

---

### 🔴 Issue: Deployment Script Fails

**Symptoms:**
- `./deploy-aws.sh` errors
- Docker installation fails
- Permission denied errors

**Solutions:**

1. **Make Script Executable**
   ```bash
   chmod +x deploy-aws.sh
   ```

2. **Run as ubuntu User (NOT root)**
   ```bash
   # Check current user
   whoami
   # Should output: ubuntu
   
   # If you're root, switch to ubuntu
   su - ubuntu
   cd /home/ubuntu/AIAgent
   ```

3. **Docker Permission Error**
   ```bash
   # After docker install, logout and login
   exit
   ssh -i your-key.pem ubuntu@YOUR_EC2_IP
   
   # Then run script again
   ./deploy-aws.sh
   ```

4. **Check Dependencies**
   ```bash
   # Verify installations
   docker --version
   docker-compose --version
   node --version
   npm --version
   
   # If any missing, install manually:
   # Docker:
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo usermod -aG docker ubuntu
   
   # Docker Compose:
   sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   
   # Node.js:
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

---

### 🔴 Issue: Database Migration Fails

**Symptoms:**
- `prisma db push` fails
- "Cannot connect to database"
- "Error: P1001: Can't reach database server"

**Solutions:**

1. **Check PostgreSQL Container**
   ```bash
   docker ps | grep postgres
   
   # If not running, start it
   docker-compose up -d postgres
   
   # Wait 30 seconds
   sleep 30
   ```

2. **Check Database Logs**
   ```bash
   docker-compose logs postgres
   
   # Look for errors like:
   # - Out of memory
   # - Disk full
   # - Permission issues
   ```

3. **Verify DATABASE_URL**
   ```bash
   cat .env | grep DATABASE_URL
   
   # Should be:
   # DATABASE_URL="postgresql://postgres:your_password@postgres:5432/callcenter?schema=public"
   ```

4. **Reset Database**
   ```bash
   # Stop all containers
   docker-compose down
   
   # Remove database volumes (WARNING: deletes all data!)
   docker volume rm aiagent_postgres_data
   
   # Start fresh
   docker-compose up -d postgres
   sleep 30
   cd packages/database
   npx prisma db push
   ```

5. **Check Database Connection Manually**
   ```bash
   docker exec -it $(docker ps -qf "name=postgres") psql -U postgres
   
   # Inside psql:
   \l                    # List databases
   \c callcenter        # Connect to callcenter database
   \dt                  # List tables
   \q                   # Quit
   ```

---

### 🔴 Issue: Containers Keep Stopping/Restarting

**Symptoms:**
- `docker ps` shows containers restarting
- Services appear then disappear

**Solutions:**

1. **Check Logs for Errors**
   ```bash
   # Find problematic container
   docker-compose ps
   
   # View its logs
   docker-compose logs service-name
   
   # Common errors:
   # - Missing environment variables
   # - Cannot connect to database
   # - Port already in use
   # - Out of memory
   ```

2. **Check Resource Usage**
   ```bash
   # Check memory
   free -h
   
   # Check disk
   df -h
   
   # If low on memory, upgrade to t3.2xlarge
   # If low on disk, increase EBS volume size
   ```

3. **Missing Environment Variables**
   ```bash
   # Check .env file exists
   ls -la .env
   
   # Verify it has all required keys
   cat .env | grep -E "OPENAI|DEEPGRAM|ELEVENLABS|TWILIO"
   
   # If missing, copy from example
   cp .env.example .env
   nano .env  # Add your API keys
   ```

4. **Port Conflicts**
   ```bash
   # Check if ports are already in use
   sudo lsof -i :3000
   sudo lsof -i :3001
   
   # Kill conflicting processes
   sudo kill -9 PID
   ```

5. **Out of Memory**
   ```bash
   # Check memory usage
   docker stats
   
   # If using >90% of RAM, upgrade instance:
   # t3.xlarge (16GB) → t3.2xlarge (32GB)
   ```

---

### 🔴 Issue: Cannot Access Frontend (Port 3000)

**Symptoms:**
- Browser shows "Unable to connect"
- Timeout when accessing http://YOUR_EC2_IP:3000

**Solutions:**

1. **Check Security Group**
   ```
   AWS Console → EC2 → Security Groups
   Add rule if missing:
     Type: Custom TCP
     Port: 3000
     Source: 0.0.0.0/0
   ```

2. **Check Frontend Container**
   ```bash
   docker ps | grep frontend
   
   # If not running, check logs
   docker-compose logs frontend
   
   # Restart if needed
   docker-compose restart frontend
   ```

3. **Check Frontend Logs**
   ```bash
   docker-compose logs frontend
   
   # Look for:
   # - Build errors
   # - Missing dependencies
   # - Port binding issues
   ```

4. **Test Locally First**
   ```bash
   # From EC2 instance
   curl http://localhost:3000
   
   # If this works but browser doesn't:
   # → Security group issue
   # → Firewall issue
   ```

5. **Rebuild Frontend**
   ```bash
   docker-compose build frontend
   docker-compose up -d frontend
   ```

---

### 🔴 Issue: Cannot Access API Gateway (Port 3001)

**Symptoms:**
- `curl http://YOUR_EC2_IP:3001/health` fails
- Twilio webhooks not working

**Solutions:**

1. **Check Security Group**
   ```
   AWS Console → EC2 → Security Groups
   Add rule:
     Type: Custom TCP
     Port: 3001
     Source: 0.0.0.0/0 (or Twilio IPs)
   ```

2. **Check API Gateway Container**
   ```bash
   docker ps | grep api-gateway
   docker-compose logs api-gateway
   ```

3. **Test Health Endpoint**
   ```bash
   # From EC2 instance
   curl http://localhost:3001/health
   
   # Should return: {"status":"ok"}
   ```

4. **Check Service Dependencies**
   ```bash
   # API Gateway needs these to be running:
   docker ps | grep -E "postgres|redis|rabbitmq"
   
   # If any missing, start them:
   docker-compose up -d postgres redis rabbitmq
   ```

---

### 🔴 Issue: Twilio Webhooks Not Working

**Symptoms:**
- Incoming calls don't reach your system
- Twilio shows webhook errors
- No logs in voice-service

**Solutions:**

1. **Verify Webhook URLs**
   ```
   Twilio Console → Phone Numbers → Active Numbers
   
   Check webhook URLs are:
   ✓ http://YOUR_EC2_IP:3001/api/webhook/voice/incoming
   ✓ Not https:// (unless you have SSL configured)
   ✓ Using your actual public IP, not 'localhost'
   ✓ Port 3001 is accessible
   ```

2. **Test Webhook Endpoint**
   ```bash
   # From your local machine
   curl -X POST http://YOUR_EC2_IP:3001/api/webhook/voice/incoming \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "From=%2B1234567890&To=%2B0987654321&CallSid=test123"
   
   # Should not return error
   ```

3. **Check Voice Service Logs**
   ```bash
   docker-compose logs -f voice-service
   
   # Make a test call and watch for incoming webhook
   ```

4. **Verify Port 3001 is Open**
   ```bash
   # From your local machine
   telnet YOUR_EC2_IP 3001
   # Or
   nc -zv YOUR_EC2_IP 3001
   
   # Should connect successfully
   ```

5. **Check Twilio Request Logs**
   ```
   Twilio Console → Monitor → Logs → Errors
   
   Look for:
   - 11200: HTTP retrieval failure
   - 11205: HTTP connection failure
   - Timeout errors
   
   These indicate your server isn't reachable
   ```

---

### 🔴 Issue: API Keys Not Working

**Symptoms:**
- OpenAI errors: "Invalid API key"
- Deepgram errors: "Unauthorized"
- ElevenLabs errors: "Authentication failed"

**Solutions:**

1. **Verify Keys in .env**
   ```bash
   # Check if keys exist (without showing values)
   cat .env | grep -E "OPENAI|DEEPGRAM|ELEVENLABS" | sed 's/=.*/=***/'
   
   # Should show:
   # OPENAI_API_KEY=***
   # DEEPGRAM_API_KEY=***
   # ELEVENLABS_API_KEY=***
   ```

2. **Check for Extra Spaces/Quotes**
   ```bash
   nano .env
   
   # Keys should be exactly:
   OPENAI_API_KEY="sk-proj-xxxxx"
   
   # NOT:
   OPENAI_API_KEY=" sk-proj-xxxxx "  ❌ (extra spaces)
   OPENAI_API_KEY='sk-proj-xxxxx'    ❌ (single quotes in some cases)
   ```

3. **Verify Keys are Valid**
   ```bash
   # Test OpenAI key
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer YOUR_OPENAI_KEY"
   
   # Should return list of models, not "invalid_api_key"
   ```

4. **Restart Services After Changing .env**
   ```bash
   # .env changes require restart
   docker-compose restart
   ```

5. **Check Service Logs**
   ```bash
   # OpenAI errors
   docker-compose logs ai-runtime-service | grep -i "openai\|api key"
   
   # Deepgram errors
   docker-compose logs voice-service | grep -i "deepgram\|unauthorized"
   ```

---

### 🔴 Issue: Out of Memory

**Symptoms:**
- Containers crashing randomly
- `docker-compose up` fails
- System very slow

**Solutions:**

1. **Check Memory Usage**
   ```bash
   free -h
   docker stats
   
   # If using >90% memory, need more RAM
   ```

2. **Stop Unnecessary Services**
   ```bash
   # For testing, you don't need all services
   # Edit docker-compose.yml to comment out unused services
   
   # Or stop specific services:
   docker-compose stop survey-service
   docker-compose stop campaign-service
   ```

3. **Upgrade Instance**
   ```
   AWS Console → EC2 → Select Instance
   Actions → Instance Settings → Change Instance Type
   
   Upgrade to:
   - t3.2xlarge (32 GB RAM)
   - t3a.xlarge (16 GB RAM, cheaper alternative)
   ```

4. **Restart Docker**
   ```bash
   docker-compose down
   sudo systemctl restart docker
   docker-compose up -d
   ```

---

### 🔴 Issue: Disk Space Full

**Symptoms:**
- "No space left on device"
- Cannot write to disk
- Build fails

**Solutions:**

1. **Check Disk Usage**
   ```bash
   df -h
   du -sh /* | sort -h
   ```

2. **Clean Docker**
   ```bash
   # Remove unused containers/images
   docker system prune -a
   
   # Remove unused volumes (WARNING: deletes data!)
   docker volume prune
   ```

3. **Clean Logs**
   ```bash
   # Docker logs can be large
   sudo sh -c 'truncate -s 0 /var/lib/docker/containers/*/*-json.log'
   ```

4. **Increase EBS Volume**
   ```
   AWS Console → EC2 → Volumes
   Select volume → Actions → Modify Volume
   Increase size (e.g., 50 GB → 100 GB)
   
   Then on EC2:
   sudo growpart /dev/nvme0n1 1
   sudo resize2fs /dev/nvme0n1p1
   df -h  # Verify new size
   ```

---

### 🔴 Issue: Services Can't Connect to Each Other

**Symptoms:**
- "Connection refused"
- "Cannot connect to postgres"
- "ECONNREFUSED redis:6379"

**Solutions:**

1. **Check Docker Network**
   ```bash
   docker network ls
   docker network inspect aiagent_default
   
   # All containers should be on same network
   ```

2. **Use Service Names, Not localhost**
   ```bash
   # In .env, use:
   DATABASE_URL="postgresql://postgres:password@postgres:5432/callcenter"
   
   # NOT:
   DATABASE_URL="postgresql://postgres:password@localhost:5432/callcenter"
   ```

3. **Check All Services Running**
   ```bash
   docker-compose ps
   
   # All should be "Up", not "Exited"
   ```

4. **Restart All Services**
   ```bash
   docker-compose down
   docker-compose up -d
   ```

---

### 🔴 Issue: Build Takes Forever / Fails

**Symptoms:**
- `docker-compose build` hangs
- Network timeout during build
- npm install fails

**Solutions:**

1. **Check Internet Connection**
   ```bash
   ping google.com
   ping registry.npmjs.org
   ```

2. **Increase Build Timeout**
   ```bash
   # Add to docker-compose.yml
   services:
     service-name:
       build:
         context: .
         args:
           BUILDKIT_TIMEOUT: 600
   ```

3. **Build One Service at a Time**
   ```bash
   # Instead of building all at once
   docker-compose build api-gateway
   docker-compose build voice-service
   # etc.
   ```

4. **Clear Build Cache**
   ```bash
   docker-compose build --no-cache
   ```

5. **Check npm Registry**
   ```bash
   # If npm slow, try different registry
   npm config set registry https://registry.npmjs.org/
   ```

---

## 🔍 Debugging Tools

### View Logs in Real-Time
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f voice-service

# Multiple services
docker-compose logs -f voice-service api-gateway

# Last 100 lines
docker-compose logs --tail=100 voice-service
```

### Enter Container Shell
```bash
# Get container ID
docker ps

# Enter container
docker exec -it CONTAINER_ID sh
# Or
docker exec -it CONTAINER_ID bash

# Check files, test connections, etc.
```

### Check Service Health
```bash
# Quick check all health endpoints
for port in {3001..3022}; do
  echo -n "Port $port: "
  curl -s http://localhost:$port/health || echo "No response"
done
```

### Monitor Resources
```bash
# Real-time container stats
docker stats

# System resources
htop
# Or
top
```

### Network Debugging
```bash
# Check what's listening on ports
sudo netstat -tlnp | grep LISTEN

# Or
sudo lsof -i -P -n | grep LISTEN

# Test connection to service
curl -v http://localhost:3001/health
```

---

## 📞 Still Having Issues?

### Collect Diagnostic Info

Run these commands and save output:

```bash
# System info
uname -a
cat /etc/os-release

# Resource usage
free -h
df -h

# Docker info
docker --version
docker-compose --version
docker ps
docker-compose ps
docker network ls

# Service logs (last 50 lines each)
docker-compose logs --tail=50 > all-logs.txt

# Environment (without secrets)
cat .env | sed 's/=.*/=***/' > env-sanitized.txt
```

### Common Patterns

**90% of issues are:**
1. ❌ Missing/wrong API keys in `.env`
2. ❌ Security group ports not open
3. ❌ Services can't connect to database (not started)
4. ❌ Out of memory (need larger instance)
5. ❌ Twilio webhook URL wrong/not accessible

**Before asking for help:**
1. ✅ Run `./health-check.sh`
2. ✅ Check `docker-compose logs`
3. ✅ Verify `.env` has all keys
4. ✅ Confirm security group allows ports 3000, 3001
5. ✅ Test health endpoint: `curl localhost:3001/health`

---

## ✅ Deployment Checklist

Use this to verify everything:

- [ ] EC2 instance running (check AWS console)
- [ ] Can SSH into instance
- [ ] Docker installed (`docker --version`)
- [ ] Docker Compose installed (`docker-compose --version`)
- [ ] Project files on EC2
- [ ] `.env` file exists and has all API keys
- [ ] Security group ports open (22, 80, 443, 3000, 3001)
- [ ] PostgreSQL container running (`docker ps | grep postgres`)
- [ ] Database schema pushed (no errors)
- [ ] All 20+ containers running (`docker ps | wc -l`)
- [ ] API health passes (`curl localhost:3001/health`)
- [ ] Frontend accessible in browser (http://YOUR_EC2_IP:3000)
- [ ] Twilio webhooks configured correctly
- [ ] Test call successful

---

**Pro Tip:** Most issues are solved by:
1. Checking logs: `docker-compose logs -f`
2. Restarting: `docker-compose restart`
3. Verifying .env: Has all API keys, no typos
4. Checking security group: Ports 3000, 3001 open
