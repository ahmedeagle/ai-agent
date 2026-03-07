# AI Agent Call Center Platform - Setup Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Python 3.11+
- Docker & Docker Compose
- PostgreSQL, MongoDB, Redis (or use Docker)

### Installation

1. **Clone and install dependencies:**
```bash
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env
```

Edit `.env` with your API keys:
- `OPENAI_API_KEY` - OpenAI API key
- `DEEPGRAM_API_KEY` - Deepgram API key
- `ELEVENLABS_API_KEY` - ElevenLabs API key
- `TWILIO_ACCOUNT_SID` - Twilio account SID
- `TWILIO_AUTH_TOKEN` - Twilio auth token
- `TWILIO_PHONE_NUMBER` - Your Twilio phone number
- `JWT_SECRET` - Generate a random secret

3. **Start infrastructure with Docker:**
```bash
docker-compose up -d postgres mongodb redis rabbitmq elasticsearch
```

4. **Run database migrations:**
```bash
cd packages/database
npm run migrate
```

5. **Start all services (development):**
```bash
npm run dev
```

This will start:
- API Gateway: http://localhost:3000
- Voice Service: http://localhost:3001
- Tool Execution: http://localhost:3002
- Recording Service: http://localhost:3003
- Admin Service: http://localhost:3004
- AI Engine: http://localhost:8000
- Analytics: http://localhost:8001
- QA Service: http://localhost:8002
- Frontend: http://localhost:3010

### Production Deployment

```bash
docker-compose up -d
```

## 📖 Architecture Overview

### Microservices

1. **API Gateway** (Node.js/TypeScript)
   - Entry point for all requests
   - Authentication & authorization
   - Request routing
   - Rate limiting

2. **Voice Service** (Node.js/TypeScript)
   - Handles Twilio webhooks
   - Real-time call management
   - WebSocket connections for live monitoring
   - Call session management

3. **AI Engine Service** (Python/FastAPI)
   - LLM processing (OpenAI GPT-4)
   - Speech-to-text (Deepgram)
   - Text-to-speech (ElevenLabs)
   - Voice pipeline orchestration

4. **Tool Execution Service** (Node.js/TypeScript)
   - Executes external API calls
   - Tool configuration management
   - Logs all tool executions

5. **Recording Service **(Node.js/TypeScript)
   - Stores call recordings in S3
   - Manages transcripts in MongoDB
   - Provides signed URLs for access

6. **Admin Service** (Node.js/TypeScript)
   - Agent CRUD operations
   - Company management
   - Call logs and history
   - User management

7. **Analytics Service** (Python/FastAPI)
   - KPI calculations
   - Call volume analytics
   - Agent performance metrics
   - Trend analysis

8. **QA Service** (Python/FastAPI)
   - Automated QA scoring using LLM
   - Compliance checking
   - Manual review support
   - Rule-based evaluations

### Frontend (Next.js 14)

- Dashboard with real-time stats
- Live call monitoring
- Call history and recordings
- Agent management
- Analytics and KPI visualization
- QA review interface

## 🔧 Configuration

### Creating Your First Agent

1. Log in to the dashboard
2. Navigate to "AI Agents"
3. Click "Create Agent"
4. Configure:
   - Name
   - Language
   - Voice
   - System prompt
   - Tools to enable
   - Escalation rules

### Adding Tools

Tools are external API integrations. Example configuration:

```json
{
  "name": "getPatientInfo",
  "endpoint": "https://api.example.com/patients",
  "method": "POST",
  "apiKey": "your-api-key",
  "parameters": {
    "patient_id": "string"
  }
}
```

### QA Rules

Define quality rules for automated scoring:

```json
{
  "rules": [
    {
      "id": "verify_identity",
      "name": "Verify Customer Identity",
      "required": true
    },
    {
      "id": "proper_greeting",
      "name": "Proper Greeting",
      "required": true
    }
  ]
}
```

## 📊 API Documentation

- API Gateway: http://localhost:3000/docs
- AI Engine: http://localhost:8000/docs
- Analytics: http://localhost:8001/docs
- QA Service: http://localhost:8002/docs

## 🧪 Testing

```bash
npm run test
```

## 📝 Database Schema

The system uses:
- **PostgreSQL** - Primary relational data (users, agents, calls, tools)
- **MongoDB** - Full transcripts and logs
- **Redis** - Caching and session management

Run Prisma Studio to explore the database:

```bash
cd packages/database
npm run studio
```

## 🔐 Security

- JWT-based authentication
- Rate limiting on all endpoints
- API key encryption
- Signed URLs for recordings
- Role-based access control

## 📈 Monitoring

- Service health endpoints at `/health`
- Logs in `logs/` directory
- RabbitMQ management UI: http://localhost:15672
- Elasticsearch for log aggregation

## 🆘 Troubleshooting

**Services won't start:**
- Check all environment variables are set
- Ensure ports are not already in use
- Verify Docker services are running

**Database connection errors:**
- Run migrations: `cd packages/database && npm run migrate`
- Check DATABASE_URL in .env

**Twilio webhooks not working:**
- Use ngrok to expose local server
- Update Twilio webhook URLs

## 📞 Support

For issues or questions, refer to the documentation or create an issue in the repository.

## 📄 License

Proprietary - All rights reserved
