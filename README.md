# AI Agent Call Center Platform

Enterprise-grade AI-powered call center platform with voice agents, real-time analytics, QA automation, omnichannel support (Voice, WhatsApp, SMS), human agent transfer, IVR systems, sentiment analysis, and comprehensive operational tools.

## 🏗 Architecture

**Microservices Backend:**
- **API Gateway** (Node.js/TypeScript) - Entry point, authentication, routing
- **Voice Service** (Node.js/TypeScript) - Real-time call handling, WebRTC
- **Tool Execution Service** (Node.js/TypeScript) - External API integrations
- **Recording Service** (Node.js/TypeScript) - Audio processing, storage
- **Admin Service** (Node.js/TypeScript) - Dashboard APIs
- **Knowledge Base Service** (Node.js/TypeScript) - RAG document management
- **Transfer Service** (Node.js/TypeScript) - Human agent escalation & routing
- **IVR Service** (Node.js/TypeScript) - Interactive voice response menus
- **SMS Service** (Node.js/TypeScript) - Text message integration (Twilio)
- **Sentiment Service** (Node.js/TypeScript) - Real-time emotion detection
- **Email Service** (Node.js/TypeScript) - Notification & summary emails
- **WhatsApp Service** (Node.js/TypeScript) - WhatsApp Business API integration
- **AI Engine Service** (Python/FastAPI) - LLM processing, voice pipeline
- **Analytics Service** (Python/FastAPI) - Data analytics, KPI calculation
- **QA Service** (Python/FastAPI) - Quality scoring, compliance

**Frontend:**
- **Next.js 14** (React/TypeScript) - Admin dashboard, real-time monitoring
- **Multilingual Support** - English & Arabic (i18n)

**Infrastructure:**
- PostgreSQL 16 - Primary database
- MongoDB 7 - Call logs, transcripts
- Redis 7 - Caching, sessions, real-time data
- RabbitMQ - Event streaming
- Elasticsearch 8 - Search, analytics
- S3 - Recording storage

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Python 3.11+
- Docker & Docker Compose

### Development Setup

1. **Clone and install dependencies:**
```bash
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your API keys:
# - OPENAI_API_KEY
# - DEEPGRAM_API_KEY
# - ELEVENLABS_API_KEY
# - TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
# - SMTP credentials (for email service)
# - WhatsApp Business API credentials (optional)
# - SendGrid API key (optional)
```

3. **Start infrastructure services:**
```bash
docker-compose up postgres mongodb redis rabbitmq elasticsearch -d
```

4. **Run database migrations:**
```bash
npm run migrate
```

5. **Start all services:**
```bash
npm run dev
```

### Using Docker (Production)

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

## 📁 Project Structure

```
ai-agent-call-center/
├── services/
│   ├── api-gateway/            # Entry point, auth, routing
│   ├── voice-service/          # Real-time voice handling
│   ├── tool-execution-service/ # API integrations
│   ├── recording-service/      # Audio processing
│   ├── admin-service/          # Admin APIs
│   ├── knowledge-base-service/ # RAG document management
│   ├── transfer-service/       # 🆕 Human agent transfer & escalation
│   ├── ivr-service/            # 🆕 IVR menu system
│   ├── sms-service/            # 🆕 SMS integration (Twilio)
│   ├── sentiment-service/      # 🆕 Real-time sentiment analysis
│   ├── email-service/          # 🆕 Email notifications
│   ├── whatsapp-service/       # 🆕 WhatsApp Business integration
│   ├── ai-engine-service/      # Python AI/ML (OpenAI, Deepgram, ElevenLabs)
│   ├── analytics-service/      # Python analytics
│   └── qa-service/             # Python QA scoring
├── frontend/                   # Next.js dashboard (EN/AR)
├── packages/
│   ├── shared/                 # Shared TypeScript code
│   └── database/               # Prisma database schemas
└── docker-compose.yml
```

## 🔑 Key Features

### Core AI & Voice
- ✅ Real-time voice AI agents with streaming (OpenAI GPT-4 + Deepgram + ElevenLabs)
- ✅ Multi-language support (English & Arabic UI)
- ✅ Tool execution & API integrations
- ✅ Call recording & transcription
- ✅ Knowledge base with RAG (vector search)

### Human Agent Features
- ✅ **Human Transfer System** - Warm/cold transfer with skills-based routing
- ✅ **Agent Status Management** - Real-time availability tracking
- ✅ **Auto-Escalation** - Sentiment-based intelligent routing
- ✅ **Call Queue Management** - Priority queuing for human agents

### IVR & Call Routing
- ✅ **Interactive Voice Response** - Multi-level menu system
- ✅ **Language Selection** - Dynamic language switching
- ✅ **Timeout Handling** - Retry logic with fallback
- ✅ **Call Analytics** - IVR selection tracking

### Omnichannel Support
- ✅ **Voice Calls** - Primary AI agent channel
- ✅ **WhatsApp** - WhatsApp Business API integration with same AI
- ✅ **SMS** - Two-way text messaging (reminders, OTP, confirmations)
- ✅ **Email** - Automated summaries, transcripts, voicemail notifications

### Sentiment & Quality
- ✅ **Real-time Sentiment Analysis** - Emotion detection during calls
- ✅ **Auto-Escalation Triggers** - Route negative calls to humans
- ✅ **Sentiment Trends** - Call quality monitoring
- ✅ **QA Automation** - Automated quality scoring

### Customer Management
- ✅ **Customer CRM** - Unified customer profiles
- ✅ **Conversation History** - Cross-channel conversation tracking
- ✅ **Custom Fields & Tags** - Customer segmentation
- ✅ **Notes & Annotations** - Agent notes on customers

### Analytics & Monitoring
- ✅ Live call monitoring dashboard
- ✅ Comprehensive KPI tracking (resolution rate, CSAT, NPS)
- ✅ Sentiment analytics
- ✅ Usage tracking & billing
- ✅ IVR analytics (selection paths, drop-off rates)
- ✅ SMS/WhatsApp/Email delivery metrics



## 🛠 Technology Stack

**Backend:**
- Node.js 20 + TypeScript 5
- Express.js + Socket.io
- Python 3.11 + FastAPI
- Prisma ORM

**Frontend:**
- Next.js 14 (App Router)
- React 18 + TypeScript
- next-intl (i18n for EN/AR)
- TanStack Query
- Shadcn/ui + Tailwind CSS
- Recharts

**AI/ML:**
- OpenAI GPT-4 (LLM)
- Deepgram (Speech-to-Text)
- ElevenLabs (Text-to-Speech)

**Integrations:**
- Twilio (Voice, SMS)
- WhatsApp Business API
- SMTP / SendGrid (Email)

**Infrastructure:**
- Docker + Docker Compose
- PostgreSQL 16 (Prisma)
- MongoDB 7 (Logs)
- Redis 7 (Cache, Sessions)
- RabbitMQ (Events)
- Elasticsearch 8 (Search)
- AWS S3 (Storage)

## 📊 Service Ports

| Service | Port | Description |
|---------|------|-------------|
| API Gateway | 3000 | Main entry point |
| Voice Service | 3001 | Real-time voice handling |
| Tool Execution | 3002 | API integrations |
| Recording Service | 3003 | Audio processing |
| Admin Service | 3004 | Admin APIs |
| Knowledge Base | 3008 | RAG document management |
| Transfer Service | 3009 | Human agent escalation |
| IVR Service | 3010 | IVR menu system |
| SMS Service | 3011 | Text messaging |
| Sentiment Service | 3012 | Emotion analysis |
| Email Service | 3013 | Email notifications |
| WhatsApp Service | 3014 | WhatsApp integration |
| Frontend | 3015 | Next.js UI |
| AI Engine | 8000 | Python AI/ML |
| Analytics | 8001 | Data analytics |
| QA Service | 8002 | Quality scoring |

## 📡 Key API Endpoints

### Transfer Service (Port 3009)
```
GET  /agents/available          # Find available human agents
PUT  /agents/:agentId/status    # Update agent status
POST /transfer/initiate         # Start call transfer
POST /transfer/:id/accept       # Accept transfer
POST /transfer/:id/reject       # Reject transfer
POST /transfer/:id/complete     # Complete transfer
POST /transfer/evaluate-escalation # Auto-escalation rules
```

### IVR Service (Port 3010)
```
POST /ivr/menu                  # Create IVR menu
GET  /ivr/menu/:id              # Get IVR menu
PUT  /ivr/menu/:id              # Update IVR menu
POST /ivr/entry/:companyId      # Twilio webhook (call entry)
POST /ivr/process/:menuId       # Process IVR selection
GET  /ivr/analytics/:companyId  # IVR analytics
```

### SMS Service (Port 3011)
```
POST /sms/send                  # Send SMS
POST /sms/reminder              # Send appointment reminder
POST /sms/call-summary          # Send call summary
POST /sms/otp                   # Send 2FA code
POST /sms/webhook               # Twilio webhook (incoming SMS)
GET  /sms/customer/:customerId  # Get SMS history
GET  /sms/analytics/:companyId  # SMS analytics
```

### Sentiment Service (Port 3012)
```
POST /sentiment/analyze         # Analyze text sentiment
POST /sentiment/analyze-batch   # Batch analysis
GET  /sentiment/call/:callId/realtime # Real-time sentiment
GET  /sentiment/call/:callId    # Sentiment history
POST /sentiment/escalate/:callId # Manual escalation
GET  /sentiment/analytics/:companyId # Sentiment analytics
```

### Email Service (Port 3013)
```
POST /email/send                # Send email
POST /email/call-summary        # Send call summary
POST /email/transcript          # Send transcript
POST /email/voicemail           # Send voicemail notification
POST /email/notification        # Send custom notification
GET  /email/history/:companyId  # Email history
GET  /email/analytics/:companyId # Email analytics
```

### WhatsApp Service (Port 3014)
```
GET  /whatsapp/webhook          # Webhook verification
POST /whatsapp/webhook          # Incoming messages
POST /whatsapp/send             # Send text message
POST /whatsapp/send-template    # Send template message
POST /whatsapp/send-media       # Send media (image/video/audio)
GET  /whatsapp/conversation/:customerId # Conversation history
GET  /whatsapp/analytics/:companyId # WhatsApp analytics
```

## 🚀 Production Deployment

### Environment Variables

Required environment variables (see `.env.example`):

**Core Services:**
- `DATABASE_URL` - PostgreSQL connection string
- `MONGODB_URL` - MongoDB connection string
- `REDIS_URL` - Redis connection string

**AI & Voice:**
- `OPENAI_API_KEY` - OpenAI API key
- `DEEPGRAM_API_KEY` - Deepgram API key
- `ELEVENLABS_API_KEY` - ElevenLabs API key

**Telephony:**
- `TWILIO_ACCOUNT_SID` - Twilio account SID
- `TWILIO_AUTH_TOKEN` - Twilio auth token
- `TWILIO_PHONE_NUMBER` - Twilio phone number

**Email (choose one):**
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` - SMTP configuration
- `SENDGRID_API_KEY` - SendGrid API key (alternative)

**WhatsApp (optional):**
- `WHATSAPP_PHONE_ID` - WhatsApp Business phone ID
- `WHATSAPP_TOKEN` - WhatsApp Business API token
- `WHATSAPP_VERIFY_TOKEN` - Webhook verification token

**Storage:**
- `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` - AWS S3 configuration

### Docker Deployment

```bash
# Production build
docker-compose up -d --build

# Check service health
docker-compose ps

# View logs
docker-compose logs -f [service-name]

# Scale services
docker-compose up -d --scale voice-service=3

# Stop all services
docker-compose down
```

### Database Migration

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Seed database (optional)
npm run seed
```

## 📊 API Documentation

Access API documentation:
- Gateway: http://localhost:3000/docs
- AI Engine: http://localhost:8000/docs
- Analytics: http://localhost:8001/docs
- QA Service: http://localhost:8002/docs

## 🧪 Testing

```bash
# Run all tests
npm run test

# Run specific service tests
npm run test:voice
npm run test:transfer
npm run test:ivr

# Run E2E tests
npm run test:e2e
```

## 🔒 Security

- JWT-based authentication
- API rate limiting
- CORS configuration
- Input validation & sanitization
- SQL injection prevention (Prisma ORM)
- Encrypted storage for sensitive data
- Twilio webhook signature verification
- WhatsApp webhook verification

## 🌍 Multilingual Support

The platform supports English and Arabic:
- UI translations in `frontend/messages/en.json` and `ar.json`
- Language switcher component
- RTL support for Arabic
- IVR menu language selection
- AI agents with multilingual capabilities

## 📈 Monitoring & Observability

- Real-time call monitoring dashboard
- Service health checks (`/health` endpoints)
- Comprehensive logging (Winston)
- Error tracking
- Performance metrics
- Call analytics & KPIs
- Sentiment trend analysis
