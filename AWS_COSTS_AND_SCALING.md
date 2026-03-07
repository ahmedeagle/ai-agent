# AWS Architecture & Pricing

## 🏗️ System Architecture on AWS EC2

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AWS EC2 Instance (Ubuntu 22.04)                 │
│                         t3.xlarge (4 vCPU, 16GB RAM)                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐                ┌──────────────────┐              │
│  │   Frontend:3000  │◄───────────────┤  User Browser    │              │
│  │   (Next.js)      │                └──────────────────┘              │
│  └─────────┬────────┘                                                   │
│            │                                                             │
│            ▼                                                             │
│  ┌──────────────────┐                ┌──────────────────┐              │
│  │ API Gateway:3001 │◄───────────────┤  Twilio Webhooks │              │
│  │   (Express)      │                └──────────────────┘              │
│  └─────────┬────────┘                                                   │
│            │                                                             │
│  ┌─────────┴────────────────────────────────────────────┐             │
│  │                21 Microservices                       │             │
│  │  ┌────────────────────────────────────────────────┐  │             │
│  │  │ Core Services (Ports 3002-3010)                │  │             │
│  │  │                                                 │  │             │
│  │  │  • Voice Service (3002) - Twilio Integration   │  │             │
│  │  │  • AI Runtime (3003) - GPT-4 / LLM Engine      │  │             │
│  │  │  • Tool Service (3004) - Function Calling      │  │             │
│  │  │  • Recording (3005) - Call Recording           │  │             │
│  │  │  • Transcript (3006) - Speech Processing       │  │             │
│  │  │  • Analytics (3007) - KPI Calculation          │  │             │
│  │  │  • QA Service (3008) - Quality Scoring         │  │             │
│  │  │  • Auth Service (3009) - Authentication        │  │             │
│  │  │  • Company Service (3010) - Multi-tenancy      │  │             │
│  │  └────────────────────────────────────────────────┘  │             │
│  │                                                        │             │
│  │  ┌────────────────────────────────────────────────┐  │             │
│  │  │ Advanced Services (Ports 3011-3022)            │  │             │
│  │  │                                                 │  │             │
│  │  │  • Transfer (3011) - Call Transfer             │  │             │
│  │  │  • IVR (3012) - Interactive Voice Response     │  │             │
│  │  │  • SMS (3013) - Text Messaging                 │  │             │
│  │  │  • Sentiment (3014) - Emotion Analysis         │  │             │
│  │  │  • Email (3015) - Email Notifications          │  │             │
│  │  │  • WhatsApp (3016) - WhatsApp Integration      │  │             │
│  │  │  • Billing (3017) - Usage & Pricing            │  │             │
│  │  │  • Campaigns (3018) - Auto-dialer              │  │             │
│  │  │  • Voicemail (3019) - Voice Messages           │  │             │
│  │  │  • Queue (3020) - Call Queue Management        │  │             │
│  │  │  • Monitoring (3021) - Supervisor Tools        │  │             │
│  │  │  • Survey (3022) - CSAT / NPS                  │  │             │
│  │  └────────────────────────────────────────────────┘  │             │
│  └────────────────────────────────────────────────────────┘             │
│                                                                          │
│  ┌──────────────────────────────────────────────────────┐              │
│  │              Data Layer (Docker Containers)          │              │
│  │                                                       │              │
│  │  • PostgreSQL:5432 - Main Database                   │              │
│  │  • MongoDB:27017 - Document Store                    │              │
│  │  • Redis:6379 - Cache & Sessions                     │              │
│  │  • RabbitMQ:5672 - Message Queue                     │              │
│  │  • Elasticsearch:9200 - Search & Logs                │              │
│  └──────────────────────────────────────────────────────┘              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
            │   OpenAI     │ │  Deepgram    │ │ ElevenLabs   │
            │   (GPT-4)    │ │    (STT)     │ │    (TTS)     │
            └──────────────┘ └──────────────┘ └──────────────┘
```

---

## 💰 AWS Cost Breakdown

### Development/Testing Environment

#### EC2 Instance (t3.xlarge)
```
Configuration:
  - 4 vCPU
  - 16 GB RAM
  - 50 GB GP3 Storage
  - Ubuntu 22.04 LTS

Cost:
  - On-Demand:        $0.1664/hour × 730 hours = $121.47/month
  - GP3 Storage:      $0.10/GB × 50 GB        = $5.00/month
  - Data Transfer:    First 100 GB free       = $0-$10/month
  
  Total: ~$130/month
```

#### With Savings (1-Year Reserved Instance)
```
  - Reserved Instance: $0.0996/hour × 730 = $72.71/month (40% savings)
  - Storage:           $5.00/month
  
  Total: ~$78/month
```

---

### Production Environment

#### Option 1: Single Larger EC2 (Simple)
```
Instance: t3.2xlarge (8 vCPU, 32 GB RAM)
  - On-Demand:        $242.93/month
  - Reserved (1-year): $145.41/month
  - Storage (100 GB):  $10.00/month
  
  Total: ~$155-255/month
```

#### Option 2: Managed Services (Scalable)
```
• EC2 (t3.large):                 $60/month
• RDS PostgreSQL (db.t3.medium):  $75/month
• ElastiCache Redis (cache.t3.small): $25/month
• Amazon MQ (mq.t3.micro):        $18/month
• S3 for recordings (100 GB):     $2.30/month
• Load Balancer:                  $22/month
• CloudWatch:                     $10/month
• Data Transfer:                  $20/month

Total: ~$232/month (but highly scalable & managed)
```

---

## 📊 Cost Optimization Strategies

### 1. **Stop When Not In Use** (Dev/Test Only)
```bash
# Stop EC2 instance
aws ec2 stop-instances --instance-ids i-1234567890abcdef0

# Start when needed
aws ec2 start-instances --instance-ids i-1234567890abcdef0

Savings: ~$120/month when stopped 50% of time = $60/month cost
```

### 2. **Use Spot Instances** (Dev/Test Only)
```
Spot Price vs On-Demand for t3.xlarge:
  - On-Demand: $0.1664/hour
  - Spot:      ~$0.05/hour (70% savings)
  - Risk:      Can be terminated with 2-min notice

Monthly Cost: ~$36.50/month
Savings:      $85/month (but not reliable for production)
```

### 3. **Reserved Instances** (Production)
```
1-Year Reserved Instance (t3.xlarge):
  - No Upfront:   $0.0996/hour = $72.71/month (40% savings)
  - Partial:      ~$400 upfront + $0.0833/hour = $60.80/month (50% savings)
  - All Upfront:  ~$700 upfront = $58.33/month (52% savings)

Recommendation: 1-Year No Upfront for flexibility
```

### 4. **Rightsizing**
```
Start Development:
  - t3.xlarge (16 GB RAM) = $121/month
  
After Testing (if sufficient):
  - t3.large (8 GB RAM) = $60/month
  - Savings: $61/month

Monitor with: docker stats
If services use <8GB, downgrade to t3.large
```

### 5. **Elastic IP** (Static IP)
```
Cost: FREE when attached to running instance
Cost: $3.60/month when NOT attached

Pro Tip: Keep instance running or release Elastic IP when stopped
```

---

## 📈 Scaling Strategy

### Stage 1: MVP Testing (Current)
```
EC2: t3.xlarge
Services: All on one instance
Cost: $130/month
Handles: ~50 concurrent calls
```

### Stage 2: Light Production
```
EC2: t3.2xlarge
Services: All on one instance
Cost: $250/month
Handles: ~100-150 concurrent calls
```

### Stage 3: Growing Production
```
Setup:
  - Application Load Balancer (ALB)
  - 2× t3.xlarge EC2 instances
  - RDS PostgreSQL (db.t3.medium)
  - ElastiCache Redis
  - S3 for recording storage

Cost: ~$400/month
Handles: ~200-300 concurrent calls
High Availability: Yes (multi-instance)
```

### Stage 4: Enterprise Scale
```
Setup:
  - Auto Scaling Group (3-10 instances)
  - RDS PostgreSQL (db.r5.large with Multi-AZ)
  - ElastiCache Redis Cluster
  - Amazon MQ (RabbitMQ managed)
  - S3 + CloudFront CDN
  - Route 53 DNS
  - CloudWatch monitoring
  - ECS Fargate (alternative to EC2)

Cost: $800-2000/month (scales with usage)
Handles: 500-5000+ concurrent calls
Auto-scales based on load
```

---

## 🔧 Resource Requirements

### Minimum (Dev/Test)
```
CPU:  4 vCPU
RAM:  16 GB
Disk: 30 GB
Instance: t3.xlarge
Concurrent Calls: ~50
```

### Recommended (Production Start)
```
CPU:  8 vCPU
RAM:  32 GB
Disk: 100 GB
Instance: t3.2xlarge
Concurrent Calls: ~150
```

### High Traffic (Enterprise)
```
CPU:  16+ vCPU (multiple instances)
RAM:  64+ GB (distributed)
Disk: 500+ GB (or S3)
Instance: Multiple c5.2xlarge
Concurrent Calls: 500+
```

---

## 💡 Cost Comparison: DIY vs Managed

### Self-Managed (Current Approach)
```
Pros:
  ✓ Full control
  ✓ Lower cost for low usage
  ✓ No vendor lock-in
  ✓ Learn AWS skills

Cons:
  ✗ You manage updates, backups, scaling
  ✗ Need DevOps knowledge
  ✗ Manual scaling

Cost: $130-250/month
Effort: High (you manage everything)
```

### Managed Services (AWS Managed)
```
Pros:
  ✓ Auto-scaling
  ✓ Automated backups
  ✓ High availability built-in
  ✓ AWS handles maintenance
  ✓ Better security defaults

Cons:
  ✗ Higher base cost
  ✗ Some vendor lock-in
  ✗ Less control

Cost: $250-400/month
Effort: Low (AWS manages infrastructure)
```

### Fully Managed Platform (e.g., Heroku, Railway)
```
Pros:
  ✓ Deploy with one command
  ✓ Zero infrastructure management
  ✓ Instant scaling
  ✓ Built-in CI/CD

Cons:
  ✗ Expensive at scale
  ✗ Limited control
  ✗ Vendor lock-in

Cost: $500-1000/month
Effort: Minimal (platform handles everything)
```

**Recommendation:** Start with self-managed EC2 (cheapest), move to managed services as you scale.

---

## 📞 Cost Per Call Estimation

### Average Call Costs (Approximate)

#### Twilio (Phone Infrastructure)
```
Inbound Calls:  $0.0085/minute
Outbound Calls: $0.014/minute
Phone Number:   $1.15/month

Example: 1000 calls × 3 min average = 3000 minutes
Cost: 3000 × $0.0085 = $25.50/month
```

#### AI Services (per call)
```
OpenAI GPT-4:
  - Input:  $5 / 1M tokens
  - Output: $15 / 1M tokens
  - Average call: ~2000 tokens = $0.03/call

Deepgram (Speech-to-Text):
  - Nova-2: $0.0043/minute
  - 3-min call: $0.013/call

ElevenLabs (Text-to-Speech):
  - Standard: 1000 chars/month free, then $0.30/1000 chars
  - Average: ~500 chars/call = $0.15/call

Total AI cost per call: ~$0.19/call
```

#### Infrastructure (AWS)
```
EC2 t3.xlarge: $130/month
Handles: 5000 calls/month
Cost per call: $0.026/call
```

#### **Total Cost Per Call: ~$0.50 - $0.75**
```
Breakdown:
  - Twilio:         $0.025-0.042/call (depending on duration)
  - AI Processing:  $0.19/call
  - Infrastructure: $0.026/call
  - Recording Storage: $0.01/call
  - Misc (bandwidth, etc): $0.02/call

Total: $0.27 - $0.50 per call
```

#### Your Pricing Model (from requirements)
```
$500 for 50 hours = $10/hour
Average 3-min call = 20 calls/hour
Your price per call: $0.50/call

Margin: Breakeven to 30% profit depending on call duration and volume
```

---

## 💳 Monthly Cost Calculator

### Calculate Your Expected Costs

```
Monthly Variables:
  - Expected calls/month: _______
  - Average call duration: _______ minutes
  - Concurrent agents needed: _______

Infrastructure:
  [ ] Dev (t3.xlarge):     $130/month
  [ ] Prod (t3.2xlarge):   $250/month
  [ ] Scaled (managed):    $400/month

Twilio:
  Calls × Duration × $0.0085 = $______

AI Services:
  Calls × $0.19 = $______

Total Estimated Monthly Cost: $______

Your Expected Revenue:
  Calls × $0.50 = $______
  
Estimated Profit: $______
```

---

## 🎯 Recommendations

### For Testing (Now)
```
✓ Use EC2 t3.xlarge: $130/month
✓ Stop instance when not testing: Save 50%
✓ Actual cost: ~$65-130/month
```

### For First 100 Customers
```
✓ Upgrade to t3.2xlarge: $250/month (Reserved)
✓ Keep all services on one instance
✓ Monitor with CloudWatch
```

### For 500+ Customers
```
✓ Move to managed services (RDS, ElastiCache, etc.)
✓ Setup Auto Scaling Group
✓ Use Application Load Balancer
✓ Implement CDN for recordings
✓ Expected cost: $400-800/month
```

### For Enterprise (1000+ customers)
```
✓ Full AWS managed services
✓ Multi-AZ deployment
✓ Auto-scaling infrastructure
✓ 24/7 monitoring & alerts
✓ Expected cost: $1000-3000/month
```

---

## 📊 ROI Calculation

### Scenario: 100 Customers Using Your Platform

```
Assumptions:
  - 100 customers
  - Each customer: $500/month (50-hour package)
  - Average usage: 40 hours/month (80% utilization)
  - Concurrent agents: 50 (across all customers)

Revenue:
  100 customers × $500 = $50,000/month

Costs:
  AWS (t3.2xlarge):       $250/month
  Twilio (20,000 calls):  $500/month
  OpenAI:                 $600/month
  Deepgram:               $260/month
  ElevenLabs:             $3,000/month
  Other (monitoring, etc): $200/month
  ─────────────────────────────────
  Total Costs:            $4,810/month

Gross Profit: $50,000 - $4,810 = $45,190/month (90% margin!)

Note: This is simplified. Add costs for: support, marketing, payment processing (2.9%), etc.
```

**Platform scales extremely well** - infrastructure costs stay relatively flat while revenue grows linearly!

---

## ✅ Cost Optimization Checklist

- [ ] Start with t3.xlarge for testing
- [ ] Use Reserved Instances for production (40% savings)
- [ ] Stop EC2 when not testing (50% savings on testing)
- [ ] Monitor resource usage with `docker stats`
- [ ] Downsize instance if resources under-utilized
- [ ] Use S3 for recording storage (cheaper than EBS)
- [ ] Enable CloudWatch alarms for cost monitoring
- [ ] Set up billing alerts in AWS
- [ ] Delete old recordings/logs regularly
- [ ] Cache frequently accessed data in Redis
- [ ] Optimize AI tokens (shorter prompts, better caching)
- [ ] Use Twilio's carrier lookup to avoid fraud

---

**Ready to deploy?** Start with the cheapest option (t3.xlarge at $130/month) and scale up as you grow!
