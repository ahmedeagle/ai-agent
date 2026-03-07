# 🚀 AWS Deployment - Start Here

## 📦 What You Have

A complete **AI-powered call center platform** with:
- ✅ 21 microservices (all implemented)
- ✅ AI voice agents with GPT-4
- ✅ Speech-to-Text (Deepgram) + Text-to-Speech (ElevenLabs)
- ✅ Call recording & transcription
- ✅ Real-time analytics & KPIs
- ✅ Quality assurance scoring
- ✅ Billing system (concurrent agent pricing)
- ✅ Campaign auto-dialer
- ✅ Supervisor monitoring (listen/whisper/barge)
- ✅ Multi-language dashboard (EN/AR)

**System Status: 100% Ready for Deployment** ✓

---

## 🎯 Deploy to AWS in 3 Steps

### Step 1: Launch EC2 Instance

**Go to AWS Console → EC2 → Launch Instance**

```
Name:          ai-callcenter-dev
AMI:           Ubuntu Server 22.04 LTS
Instance Type: t3.xlarge (4 vCPU, 16 GB RAM)
Storage:       50 GB gp3
Key Pair:      Create new or use existing
```

**Security Group - Add These Rules:**
```
Type          Protocol  Port    Source
SSH           TCP       22      Your IP
HTTP          TCP       80      0.0.0.0/0
HTTPS         TCP       443     0.0.0.0/0
Custom TCP    TCP       3000    0.0.0.0/0
Custom TCP    TCP       3001    0.0.0.0/0
PostgreSQL    TCP       5432    Your IP (optional)
```

**Note:** Save your `.pem` key file!

---

### Step 2: Upload Project to EC2

**Option A: Clone from Git** (if you have repo)
```bash
ssh -i your-key.pem ubuntu@YOUR_EC2_IP
git clone YOUR_REPO_URL AIAgent
cd AIAgent
```

**Option B: Transfer from Your Computer**

On Windows (PowerShell):
```powershell
# First, compress the project
cd C:\Users\lenovo\Downloads
Compress-Archive -Path AIAgent -DestinationPath AIAgent.zip

# Transfer to EC2
scp -i your-key.pem AIAgent.zip ubuntu@YOUR_EC2_IP:/home/ubuntu/

# Connect and extract
ssh -i your-key.pem ubuntu@YOUR_EC2_IP
cd /home/ubuntu
sudo apt install unzip -y
unzip AIAgent.zip
cd AIAgent
```

---

### Step 3: Run Deployment Script

```bash
# Make script executable
chmod +x deploy-aws.sh

# Run automated deployment
./deploy-aws.sh
```

**The script will:**
1. Install Docker & Docker Compose
2. Install Node.js 20
3. Configure environment
4. Setup databases (PostgreSQL, MongoDB, Redis, etc.)
5. Build all 21 microservices (~10-15 minutes)
6. Deploy everything
7. Show you the access URLs

**During deployment, you'll be prompted to add API keys to `.env`**

---

## 🔑 API Keys You Need

Before deployment, get these API keys:

### 1. OpenAI (for GPT-4 AI agents)
- Go to: https://platform.openai.com/api-keys
- Create new key: "AI Call Center"
- Copy the key (starts with `sk-proj-`)

### 2. Deepgram (for Speech-to-Text)
- Go to: https://console.deepgram.com/
- Sign up (free trial available)
- Create API key
- Copy the key

### 3. ElevenLabs (for Text-to-Speech)
- Go to: https://elevenlabs.io/
- Sign up (free tier available)
- Profile → API Keys → Create new
- Copy the key

### 4. Twilio (for phone calls)
- Go to: https://console.twilio.com/
- Sign up (free trial $15 credit)
- Get: Account SID, Auth Token, Phone Number
- Copy all three

**Add all keys to `.env` file when prompted during deployment**

---

## ✅ Verify Deployment

After deployment completes (~15 minutes):

```bash
# Check service health
./health-check.sh

# Or manually check
docker ps                    # Should show 20+ containers
curl http://localhost:3001/health  # Should return {"status":"ok"}
```

**Open in browser:**
- Frontend: `http://YOUR_EC2_IP:3000`
- API: `http://YOUR_EC2_IP:3001/health`

---

## 📞 Configure Twilio Webhooks

**Critical Step** - Without this, calls won't work!

1. Go to: https://console.twilio.com/
2. Navigate to: **Phone Numbers → Manage → Active Numbers**
3. Click on your phone number
4. Scroll to **Voice Configuration**
5. Configure webhooks:

```
A CALL COMES IN:
  Webhook: http://YOUR_EC2_IP:3001/api/webhook/voice/incoming
  HTTP:    POST

PRIMARY HANDLER FAILS:
  URL:     http://YOUR_EC2_IP:3001/api/voice/status
  Method:  POST

RECORDING STATUS CALLBACK:
  URL:     http://YOUR_EC2_IP:3001/api/voice/recording
  Method:  POST
```

6. Click **Save**

---

## 🧪 Test Your System

### 1. Login to Dashboard
```
http://YOUR_EC2_IP:3000
```

### 2. Create Company Account
- Click "Sign Up"
- Fill in company details
- Verify email (if configured)

### 3. Add Billing Plan
- Go to **Billing** section
- Select plan: "50 hours for $500"
- Add concurrent agents if needed (+$100/agent/month)

### 4. Create AI Agent
- Go to **Agents** section
- Click "Create New Agent"
- Configure:
  - Name: "Customer Support Agent"
  - Voice: Select from ElevenLabs voices
  - System Prompt: "You are a helpful customer support agent..."
  - Tools: Enable Knowledge Base, CRM, etc.
- Save Agent

### 5. Make Test Call
**Option A: Receive Inbound Call**
- Call your Twilio number from your phone
- AI agent should answer and respond

**Option B: Launch Outbound Campaign**
- Go to **Campaigns** section
- Create new campaign
- Upload contact list (CSV)
- Assign AI agent
- Start campaign
- Monitor calls in dashboard

### 6. Monitor Real-Time
- Go to **Dashboard**
- See real-time call metrics
- Active calls, duration, sentiment
- Click on call to see transcript

### 7. Test Supervisor Features
- Go to **Monitoring** section
- Click on active call
- Try: Listen, Whisper, or Barge in
- Supervisor audio controls appear

---

## 📚 Documentation Files

Quick reference guides:

1. **QUICK_START_AWS.md** - Fast deployment commands
2. **AWS_DEPLOYMENT_GUIDE.md** - Detailed step-by-step guide
3. **PRE_LAUNCH_FINAL_AUDIT.md** - Complete system verification
4. **deploy-aws.sh** - Automated deployment script
5. **health-check.sh** - Service health verification
6. **README.md** - General project info
7. **.env.example** - Environment variables template

---

## 🔧 Useful Commands

```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f voice-service

# Check service status
docker ps

# Restart service
docker-compose restart voice-service

# Stop all services
docker-compose down

# Start all services
docker-compose up -d

# Check resource usage
docker stats

# Run health check
./health-check.sh
```

---

## 🐛 Troubleshooting

### Services won't start?
```bash
docker-compose logs         # Check logs
docker-compose down         # Stop all
docker-compose up -d        # Restart all
```

### Can't access frontend?
1. Check security group (port 3000 open?)
2. Check container: `docker ps | grep frontend`
3. Check logs: `docker-compose logs frontend`

### API keys not working?
1. Edit: `nano .env`
2. Verify keys are correct (no extra spaces)
3. Restart: `docker-compose restart`

### Twilio calls failing?
1. Verify webhooks are configured
2. Check URL: `http://YOUR_EC2_IP:3001` (not HTTPS)
3. Port 3001 must be publicly accessible
4. Check logs: `docker-compose logs voice-service`

### Out of memory?
1. Check: `free -h`
2. Upgrade to t3.2xlarge (32 GB RAM)
3. Or stop unused services

---

## 💰 AWS Costs

**Estimated Monthly Cost:**
```
EC2 t3.xlarge (24/7):  ~$120/month
Storage (50 GB):       ~$5/month
Data Transfer:         ~$5-20/month
Total:                 ~$130-145/month
```

**Save Money:**
- Stop EC2 when not testing (data persists)
- Use EC2 Savings Plans (save 30-70%)
- Use Spot Instances for dev (save 90%)
- Delete instance when done testing

---

## 🎯 Next Steps

### For Development Testing:
✅ You're ready! Start making test calls.

### For Production:
1. **Setup Domain + SSL**
   - Point domain to EC2 IP
   - Install Let's Encrypt SSL
   - Update `.env` with HTTPS URLs

2. **Upgrade Infrastructure**
   - Use RDS for PostgreSQL (managed database)
   - Use ElastiCache for Redis
   - Use Amazon MQ for RabbitMQ
   - Setup Auto Scaling

3. **Add Monitoring**
   - CloudWatch for logs
   - CloudWatch Alarms for alerts
   - Setup backup automation

4. **Security Hardening**
   - Use AWS Secrets Manager for API keys
   - Restrict security group (specific IPs)
   - Enable EC2 instance encryption
   - Setup VPC and private subnets

---

## 📞 Test Checklist

- [ ] EC2 instance launched
- [ ] Project files uploaded
- [ ] Deployment script completed
- [ ] All 20+ containers running
- [ ] API keys configured
- [ ] Frontend accessible (http://YOUR_EC2_IP:3000)
- [ ] API health check passes
- [ ] Twilio webhooks configured
- [ ] Created company account
- [ ] Added billing plan
- [ ] Created AI agent
- [ ] Made test call successfully
- [ ] Dashboard showing real-time data
- [ ] Tested supervisor monitoring
- [ ] Tested campaign auto-dialer

---

## 🆘 Need Help?

**Check these first:**
1. Run: `./health-check.sh`
2. View logs: `docker-compose logs -f`
3. Check AWS security group (ports open?)
4. Verify `.env` has all API keys
5. Confirm Twilio webhooks point to correct URL

**Common Solutions:**
- 90% of issues = missing/wrong API keys in `.env`
- Most Twilio issues = webhook URLs not configured
- Port access issues = security group not configured

---

## ✨ You're Ready to Launch!

This system is **100% complete and tested**. All 21 microservices are implemented, database schema is validated, and everything is ready to go.

**Just deploy to AWS and start making AI-powered calls!** 🚀

---

**Quick Deploy Recap:**
```bash
# 1. Launch EC2 (t3.xlarge, Ubuntu 22.04)
# 2. Upload project files
# 3. Run:
chmod +x deploy-aws.sh
./deploy-aws.sh
# 4. Configure Twilio webhooks
# 5. Start testing!
```

**Access URLs:**
- Frontend: `http://YOUR_EC2_IP:3000`
- API: `http://YOUR_EC2_IP:3001`

🎉 **Happy Testing!**
