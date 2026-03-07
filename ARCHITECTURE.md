# 🏗️ Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                           │
│                                                                   │
│    ┌──────────────────────────────────────────────────────┐    │
│    │         Next.js 14 Dashboard (React/TypeScript)      │    │
│    │                                                       │    │
│    │  • Real-time call monitoring                         │    │
│    │  • Analytics & KPI visualization                     │    │
│    │  • Agent management                                  │    │
│    │  • QA review interface                               │    │
│    └──────────────────────────────────────────────────────┘    │
│                              │                                    │
│                              │ HTTPS/WebSocket                   │
└──────────────────────────────┼────────────────────────────────────┘
                               │
┌──────────────────────────────┼────────────────────────────────────┐
│                         API Gateway Layer                         │
│                                                                   │
│    ┌──────────────────────────────────────────────────────┐    │
│    │           API Gateway (Node.js/TypeScript)           │    │
│    │                                                       │    │
│    │  • Authentication & Authorization (JWT)              │    │
│    │  • Rate limiting (Redis)                             │    │
│    │  • Request routing & load balancing                  │    │
│    │  • API versioning                                    │    │
│    └──────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                       │
┌───────▼────────┐   ┌────────▼────────┐   ┌────────▼──────────┐
│  Voice Service │   │  Admin Service  │   │ Recording Service │
│                │   │                 │   │                   │
│ • Twilio       │   │ • Agent CRUD    │   │ • S3 Storage      │
│ • WebRTC       │   │ • Call logs     │   │ • Transcripts     │
│ • Live calls   │   │ • User mgmt     │   │ • Audio files     │
└────────┬───────┘   └────────┬────────┘   └─────────┬─────────┘
         │                    │                        │
         └────────────┬───────┴───────┬────────────────┘
                      │               │
        ┌─────────────▼───────────────▼────────────┐
        │      Tool Execution Service              │
        │                                          │
        │  • External API integrations             │
        │  • Tool orchestration                    │
        │  • Execution logging                     │
        └──────────────────────────────────────────┘
                      │
        ┌─────────────┴──────────────┐
        │                            │
┌───────▼──────────┐     ┌──────────▼────────────┐
│  AI Engine       │     │  Analytics Service    │     ┌────────────────┐
│  (Python/FastAPI)│     │  (Python/FastAPI)     │     │  QA Service    │
│                  │     │                       │     │ (Python/FastAPI)│
│ • OpenAI GPT-4   │     │ • KPI calculation     │     │                │
│ • Deepgram STT   │     │ • Data analytics      │     │ • Auto QA      │
│ • ElevenLabs TTS │     │ • Trend analysis      │     │ • Compliance   │
│ • LLM processing │     │ • Agent performance   │     │ • Manual review│
└──────────────────┘     └───────────────────────┘     └────────────────┘
         │                           │                          │
         └───────────────────────────┼──────────────────────────┘
                                     │
┌────────────────────────────────────┼──────────────────────────────────┐
│                         Data & Message Layer                          │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────┐ │
│  │ PostgreSQL   │  │  MongoDB     │  │    Redis     │  │ RabbitMQ│ │
│  │              │  │              │  │              │  │         │ │
│  │ • Users      │  │ • Transcripts│  │ • Sessions   │  │ • Events│ │
│  │ • Agents     │  │ • Full logs  │  │ • Cache      │  │ • Queues│ │
│  │ • Calls      │  │ • Analytics  │  │ • Rate limit │  │ •Streams│ │
│  │ • Tools      │  │              │  │              │  │         │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────┘ │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐                                 │
│  │Elasticsearch │  │      S3      │                                 │
│  │              │  │              │                                 │
│  │ • Log search │  │ • Recordings │                                 │
│  │ • Analytics  │  │ • Audio files│                                 │
│  └──────────────┘  └──────────────┘                                 │
└───────────────────────────────────────────────────────────────────────┘
                                     │
┌────────────────────────────────────┼──────────────────────────────────┐
│                      External Services                                │
│                                                                       │
│    ┌──────────┐     ┌──────────┐     ┌──────────────┐              │
│    │  Twilio  │     │  OpenAI  │     │  Deepgram    │              │
│    │          │     │          │     │              │              │
│    │ Telephony│     │   LLM    │     │     STT      │              │
│    └──────────┘     └──────────┘     └──────────────┘              │
│                                                                       │
│    ┌──────────┐                                                      │
│    │ElevenLabs│                                                      │
│    │          │                                                      │
│    │   TTS    │                                                      │
│    └──────────┘                                                      │
└───────────────────────────────────────────────────────────────────────┘
```

## Data Flow: Incoming Call

```
1. Call comes in → Twilio
2. Twilio webhook → Voice Service
3. Voice Service → Creates session in Redis
4. Voice Service → Triggers AI Engine
5. AI Engine → Deepgram (STT) → OpenAI (LLM) → ElevenLabs (TTS)
6. AI Engine → Tool Execution (if needed)
7. Call ends → Recording Service → S3 + MongoDB
8. Recording Service → Triggers QA Service
9. QA Service → Automated scoring
10. Analytics Service → Updates KPIs
11. Frontend → Real-time updates via WebSocket
```

## Tech Stack Summary

### Backend Services
- **Node.js 20 + TypeScript 5** - Microservices
- **Express.js** - HTTP framework
- **Socket.io** - WebSocket for real-time
- **Python 3.11 + FastAPI** - AI/ML services
- **Prisma** - Database ORM
- **RabbitMQ** - Message queue
- **Redis** - Caching & sessions

### Frontend
- **Next.js 14** - React framework
- **TypeScript 5** - Type safety
- **TanStack Query** - Data fetching
- **Tailwind CSS** - Styling
- **Recharts** - Data visualization
- **Socket.io-client** - Real-time updates

### Infrastructure
- **Docker & Docker Compose** - Containerization
- **PostgreSQL 16** - Primary database
- **MongoDB 7** - Document store
- **Redis 7** - Cache
- **RabbitMQ 3** - Message broker
- **Elasticsearch 8** - Search & analytics
- **AWS S3** - Object storage

### AI/ML Services
- **OpenAI GPT-4** - LLM reasoning
- **Deepgram** - Speech-to-Text
- **ElevenLabs** - Text-to-Speech
- **Twilio** - Telephony

## Scalability Features

1. **Horizontal Scaling**
   - All services are stateless
   - Load balancing via API Gateway
   - Session storage in Redis

2. **Async Processing**
   - RabbitMQ for event-driven architecture
   - Background jobs for analytics
   - Delayed QA processing

3. **Caching Strategy**
   - Redis for hot data
   - CDN for static assets
   - API response caching

4. **Database Optimization**
   - Indexed queries
   - Connection pooling
   - Read replicas (production)

5. **Monitoring & Observability**
   - Health check endpoints
   - Centralized logging (Elasticsearch)
   - Metrics collection
   - Error tracking

## Security Features

1. **Authentication**
   - JWT tokens
   - Role-based access control (RBAC)
   - Session management

2. **API Security**
   - Rate limiting
   - CORS configuration
   - Input validation (Zod)
   - SQL injection prevention (Prisma)

3. **Data Security**
   - Encrypted storage
   - Signed URLs for recordings
   - API key encryption
   - HTTPS everywhere

4. **Compliance**
   - PII detection
   - Call recording consent
   - Audit logs
   - GDPR considerations

## Performance Optimizations

1. **Frontend**
   - Server-side rendering (SSR)
   - Code splitting
   - Image optimization
   - Lazy loading

2. **Backend**
   - Connection pooling
   - Query optimization
   - Caching layers
   - Compression

3. **Real-time**
   - WebSocket connections
   - Event streaming
   - Optimistic updates

## Deployment Strategy

### Development
```bash
npm run dev  # Runs all services locally
```

### Staging
```bash
docker-compose -f docker-compose.staging.yml up
```

### Production
```bash
docker-compose up -d
# Or use Kubernetes for orchestration
```

## Monitoring Endpoints

- API Gateway: http://localhost:3000/health
- Voice Service: http://localhost:3001/health
- Admin Service: http://localhost:3004/health
- AI Engine: http://localhost:8000/health
- Analytics: http://localhost:8001/health
- QA Service: http://localhost:8002/health

## Key Features Implemented

✅ Real-time voice AI agents with streaming
✅ Multi-language support
✅ Tool execution (API integrations)
✅ Call recording & transcription
✅ Automated QA scoring
✅ Comprehensive KPI dashboard
✅ Live call monitoring
✅ Usage tracking & billing
✅ Escalation management
✅ Compliance checking
✅ Role-based access control
✅ WebSocket real-time updates
✅ Scalable microservices architecture
✅ Docker containerization
✅ Production-ready infrastructure
