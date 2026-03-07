# 🚀 Quick Start Guide

## Prerequisites

Before starting, ensure you have:
- ✅ Node.js 20+ installed
- ✅ Python 3.11+ installed
- ✅ Docker & Docker Compose installed
- ✅ Git installed

## API Keys Required

You'll need the following API keys:

### Required (Core Functionality):
1. **OpenAI API Key** - For AI agents (GPT-4)
   - Get it at: https://platform.openai.com/api-keys
   
2. **Deepgram API Key** - For speech-to-text
   - Get it at: https://console.deepgram.com/
   
3. **ElevenLabs API Key** - For text-to-speech
   - Get it at: https://elevenlabs.io/app/settings/api-keys
   
4. **Twilio Account** - For voice calls and SMS
   - Get it at: https://www.twilio.com/console
   - You need: Account SID, Auth Token, Phone Number

### Optional (Advanced Features):
5. **WhatsApp Business API** - For WhatsApp integration
   - Get it at: https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
   
6. **SendGrid API Key** - For email (alternative to SMTP)
   - Get it at: https://app.sendgrid.com/settings/api_keys

7. **AWS S3 Credentials** - For recording storage
   - Get it at: https://console.aws.amazon.com/iam/

## Installation Steps

### 1. Clone the Repository
```bash
cd AIAgent
```

### 2. Install Dependencies
```bash
# Install root dependencies
npm install

# Install service dependencies (optional, Docker will handle this)
cd services/api-gateway && npm install
cd ../voice-service && npm install
# ... repeat for other services
```

### 3. Set Up Environment Variables
```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your API keys
nano .env  # or use your favorite editor
```

**Minimum required variables:**
```env
# Database (use defaults for development)
DATABASE_URL=postgresql://user:password@localhost:5432/ai_agent_db
MONGODB_URL=mongodb://localhost:27017/ai_agent_logs
REDIS_URL=redis://localhost:6379

# AI Services (REQUIRED)
OPENAI_API_KEY=sk-...
DEEPGRAM_API_KEY=...
ELEVENLABS_API_KEY=...

# Twilio (REQUIRED for calls)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1234567890

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

### 4. Start Infrastructure with Docker
```bash
# Start databases and message queues
docker-compose up postgres mongodb redis rabbitmq elasticsearch -d

# Wait for services to be ready (30 seconds)
sleep 30
```

### 5. Run Database Migrations
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Optional: Seed with sample data
npm run seed
```

### 6. Start All Services

#### Option A: Using Docker (Recommended for Production)
```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check service health
docker-compose ps
```

#### Option B: Manual Start (Recommended for Development)
```bash
# Terminal 1: API Gateway
cd services/api-gateway
npm run dev

# Terminal 2: Voice Service
cd services/voice-service
npm run dev

# Terminal 3: AI Engine (Python)
cd services/ai-engine-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 4: Transfer Service
cd services/transfer-service
npm run dev

# Terminal 5: IVR Service
cd services/ivr-service
npm run dev

# Terminal 6: SMS Service
cd services/sms-service
npm run dev

# Terminal 7: Sentiment Service
cd services/sentiment-service
npm run dev

# Terminal 8: Email Service
cd services/email-service
npm run dev

# Terminal 9: WhatsApp Service
cd services/whatsapp-service
npm run dev

# Terminal 10: Frontend
cd frontend
npm run dev
```

### 7. Access the Platform

Once all services are running:

- **Frontend Dashboard:** http://localhost:3015
- **API Gateway:** http://localhost:3000
- **API Documentation:** http://localhost:3000/docs

## First Time Setup

### 1. Create Your First Company
```bash
# Using curl
curl -X POST http://localhost:3000/api/companies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Company",
    "twilioAccountSid": "AC...",
    "twilioAuthToken": "...",
    "twilioPhoneNumber": "+1234567890",
    "emailFrom": "support@mycompany.com"
  }'
```

### 2. Create an AI Agent
```bash
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Customer Support Agent",
    "companyId": "your-company-id",
    "systemPrompt": "You are a helpful customer support agent.",
    "voice": "alloy",
    "language": "en"
  }'
```

### 3. Create an IVR Menu
```bash
curl -X POST http://localhost:3010/ivr/menu \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Main Menu",
    "companyId": "your-company-id",
    "entryPrompt": "Press 1 for sales, 2 for support, 3 for billing",
    "language": "en",
    "options": [
      {"key": "1", "label": "Sales", "action": "route_agent", "target": "sales-agent-id"},
      {"key": "2", "label": "Support", "action": "route_agent", "target": "support-agent-id"},
      {"key": "3", "label": "Billing", "action": "route_human", "target": "billing"}
    ]
  }'
```

### 4. Configure Twilio Webhooks

In your Twilio Console, set these webhooks:

**Voice Webhook:**
- URL: `https://your-domain.com/ivr/entry/YOUR_COMPANY_ID`
- Method: POST

**SMS Webhook:**
- URL: `https://your-domain.com/sms/webhook`
- Method: POST

**WhatsApp Webhook (if using):**
- URL: `https://your-domain.com/whatsapp/webhook`
- Method: POST

## Testing Your Setup

### Test Voice Call
1. Call your Twilio phone number
2. You should hear the IVR prompt
3. Press a digit to navigate
4. You'll be connected to an AI agent

### Test SMS
```bash
# Send a text message to your Twilio number
# You should receive an AI-powered response
```

### Test WhatsApp
1. Send a message to your WhatsApp Business number
2. You should receive an AI response

### Test Email
```bash
# Trigger a call summary email
curl -X POST http://localhost:3013/email/call-summary \
  -H "Content-Type: application/json" \
  -d '{
    "callId": "your-call-id"
  }'
```

## Troubleshooting

### Problem: Services won't start
```bash
# Check if ports are already in use
lsof -i :3000  # API Gateway
lsof -i :5432  # PostgreSQL
lsof -i :27017 # MongoDB

# Kill processes using these ports
kill -9 <PID>
```

### Problem: Database connection errors
```bash
# Restart PostgreSQL
docker-compose restart postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Verify DATABASE_URL is correct
echo $DATABASE_URL
```

### Problem: Missing Prisma client
```bash
# Regenerate Prisma client
npx prisma generate

# If that fails, reinstall
rm -rf node_modules
npm install
npx prisma generate
```

### Problem: AI Engine errors
```bash
# Check Python dependencies
cd services/ai-engine-service
pip install -r requirements.txt

# Verify API keys are set
echo $OPENAI_API_KEY
echo $DEEPGRAM_API_KEY
echo $ELEVENLABS_API_KEY
```

### Problem: Twilio webhook errors
```bash
# Use ngrok for local development
ngrok http 3010

# Update Twilio webhooks with ngrok URL
# Format: https://xxxx-xx-xxx.ngrok.io/ivr/entry/YOUR_COMPANY_ID
```

## Development Tips

### Hot Reload
All Node.js services use `nodemon` for hot reload. Changes to `.ts` files will automatically restart the service.

### View Logs
```bash
# Docker logs
docker-compose logs -f [service-name]

# Individual service logs
cd services/[service-name]
npm run dev  # logs will appear in terminal
```

### Database Management
```bash
# Prisma Studio (database GUI)
npx prisma studio

# Create a new migration
npx prisma migrate dev --name add_new_feature

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

### Testing Individual Services
```bash
# Test Transfer Service
curl http://localhost:3009/health

# Test IVR Service
curl http://localhost:3010/health

# Test SMS Service
curl http://localhost:3011/health

# Test Sentiment Service
curl http://localhost:3012/health

# Test Email Service
curl http://localhost:3013/health

# Test WhatsApp Service
curl http://localhost:3014/health
```

## Next Steps

1. **Configure IVR Menus** - Create custom phone menus
2. **Add Human Agents** - Set up human agent profiles with skills
3. **Upload Knowledge Base** - Add documents for RAG
4. **Configure Email Templates** - Customize email designs
5. **Set Up Analytics** - Configure KPI dashboards
6. **Test Sentiment Analysis** - Monitor call quality
7. **Enable WhatsApp** - Connect WhatsApp Business API

## Support

For issues or questions:
1. Check logs: `docker-compose logs -f`
2. Review API documentation: http://localhost:3000/docs
3. Check individual service health: `http://localhost:[PORT]/health`

## Production Deployment

For production deployment guide, see:
- [README.md](./README.md) - Full documentation
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Feature overview
