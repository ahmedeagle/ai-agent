# 💰 Billing Service - Concurrent Agent Pricing

## Overview

The Billing Service implements a sophisticated dual-pricing model combining **usage-based billing** (call minutes) with **capacity-based billing** (concurrent agents). This allows companies to scale their AI agent capacity dynamically while tracking all billable events.

## 🎯 Pricing Model

### 1. Usage-Based Pricing (Call Minutes)

**Package Structure:**
```json
{
  "name": "50h Package",
  "minutesIncluded": 3000,        // 50 hours = 3000 minutes
  "pricePerMinute": 0.167,        // $500 / 3000 = $0.167/min
  "totalPrice": 500,
  "billingCycle": "monthly"
}
```

**Features:**
- Pre-purchase minute packages (e.g., "50h for $500")
- Minutes deducted as calls are made
- Automatic overage charges when package exhausted
- 80% usage alert notifications
- Remaining minutes tracking in real-time

---

### 2. Capacity-Based Pricing (Concurrent Agents)

**Concurrent Agent Model:**
```json
{
  "concurrentAgentsIncluded": 1,  // Base: 1 agent
  "pricePerAgent": 100,            // Additional: $100/agent/month
  "maxConcurrentAgents": 10,       // Company limit (dynamic)
  "currentConcurrentAgents": 3     // Live active agents
}
```

**Pricing Examples:**

| Concurrent Agents | Monthly Cost | Calculation |
|------------------|-------------|-------------|
| 1 agent (base) | $500 | Base package |
| 2 agents | $600 | $500 + (1 × $100) |
| 5 agents | $900 | $500 + (4 × $100) |
| 10 agents | $1,400 | $500 + (9 × $100) |
| 20 agents | $2,400 | $500 + (19 × $100) |

**Key Features:**
- **Dynamic Scaling:** Increase/decrease agent limit on-demand
- **Real-time Enforcement:** Check before starting calls if capacity available
- **Automatic Billing:** Usage logs created when limits changed
- **Live Tracking:** Current active agents vs max allowed
- **Upgrade Prompts:** UI prompts when max capacity reached

---

## 📊 How It Works

### Step 1: Purchase Base Package
```bash
POST /api/billing/packages
{
  "companyId": "company-123",
  "name": "Standard 50h Package",
  "type": "minutes",
  "minutesIncluded": 3000,
  "concurrentAgentsIncluded": 1,
  "pricePerAgent": 100,
  "totalPrice": 500,
  "billingCycle": "monthly"
}
```

**Result:**
- ✅ Company gets 3000 minutes (50 hours)
- ✅ 1 concurrent agent included
- ✅ `maxConcurrentAgents` set to 1
- ✅ `minutesAllocated` increased by 3000
- ✅ Package expires in 30 days (monthly)

---

### Step 2: Dynamic Concurrent Agent Upgrade

**Scenario:** Company needs 5 concurrent agents instead of 1

```bash
POST /api/billing/concurrent-agents/update
{
  "companyId": "company-123",
  "newLimit": 5,
  "pricePerAgent": 100
}
```

**Result:**
```json
{
  "success": true,
  "data": {
    "oldLimit": 1,
    "newLimit": 5,
    "additionalAgents": 4,
    "additionalCost": 400
  }
}
```

**What Happens:**
1. ✅ `maxConcurrentAgents` updated from 1 to 5
2. ✅ UsageLog created: `type: "concurrent_agent"`, `quantity: 4`, `cost: 400`
3. ✅ Company can now handle 5 simultaneous calls
4. ✅ Next invoice includes $400 additional charge

**Database Changes:**
```sql
-- Company table updated
UPDATE Company 
SET maxConcurrentAgents = 5 
WHERE id = 'company-123';

-- Usage log created
INSERT INTO UsageLog (
  companyId,
  type,
  quantity,
  cost,
  description
) VALUES (
  'company-123',
  'concurrent_agent',
  4,
  400.00,
  'Increased concurrent agents from 1 to 5'
);
```

---

### Step 3: Real-time Concurrent Limit Enforcement

**Before Starting a Call:**
```bash
POST /api/billing/concurrent-agents/check
{
  "companyId": "company-123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "canStart": true,
    "currentConcurrent": 4,
    "maxConcurrent": 5,
    "remainingSlots": 1,
    "needsUpgrade": false
  }
}
```

**If Max Reached:**
```json
{
  "canStart": false,
  "currentConcurrent": 5,
  "maxConcurrent": 5,
  "remainingSlots": 0,
  "needsUpgrade": true  // Show upgrade prompt in UI
}
```

---

### Step 4: Call Lifecycle Tracking

**When Call Starts:**
```bash
POST /api/billing/concurrent-agents/increment
{
  "companyId": "company-123"
}
```

**Result:**
- `currentConcurrentAgents`: 4 → 5

**When Call Ends:**
```bash
POST /api/billing/concurrent-agents/decrement
{
  "companyId": "company-123"
}
```

**Result:**
- `currentConcurrentAgents`: 5 → 4
- Minutes consumed logged via `/billing/usage/call`

---

### Step 5: Usage Tracking (Call Minutes)

**Log Call Minutes:**
```bash
POST /api/billing/usage/call
{
  "companyId": "company-123",
  "callId": "call-456",
  "durationMinutes": 15
}
```

**Processing Logic:**
1. **Check Active Package:**
   - Find active package for company
   - Check `minutesRemaining`

2. **Deduct Minutes:**
   - If `minutesRemaining >= 15`:
     - Deduct 15 minutes from package
     - No additional charge
   - If `minutesRemaining < 15`:
     - Deduct available minutes
     - Charge overage: `(15 - minutesRemaining) × pricePerMinute`

3. **Create Usage Log:**
   ```json
   {
     "companyId": "company-123",
     "packageId": "pkg-789",
     "callId": "call-456",
     "type": "call_minutes",
     "quantity": 15,
     "cost": 0  // or overage cost
   }
   ```

4. **Check Alert Threshold:**
   - If `minutesRemaining < minutesIncluded × 0.2` (80% used):
     - Create notification: "Minutes Running Low"

---

### Step 6: Monthly Invoice Generation

**Generate Invoice:**
```bash
POST /api/billing/invoices/generate
{
  "companyId": "company-123",
  "periodStart": "2024-01-01",
  "periodEnd": "2024-01-31"
}
```

**Invoice Calculation:**
```javascript
// Get all usage logs for period
const logs = await UsageLog.findMany({
  where: {
    companyId: "company-123",
    createdAt: {
      gte: "2024-01-01",
      lte: "2024-01-31"
    }
  }
});

// Calculate costs by type
const callMinutesCost = logs
  .filter(l => l.type === 'call_minutes')
  .reduce((sum, l) => sum + l.cost, 0);

const concurrentAgentCost = logs
  .filter(l => l.type === 'concurrent_agent')
  .reduce((sum, l) => sum + l.cost, 0);

const smsCost = logs
  .filter(l => l.type === 'sms')
  .reduce((sum, l) => sum + l.cost, 0);

const whatsappCost = logs
  .filter(l => l.type === 'whatsapp')
  .reduce((sum, l) => sum + l.cost, 0);

// Build invoice
const subtotal = callMinutesCost + concurrentAgentCost + smsCost + whatsappCost;
const tax = subtotal * 0.10;  // 10% tax
const total = subtotal + tax;

const invoice = {
  invoiceNumber: "INV-COMPANY123-0001",
  periodStart: "2024-01-01",
  periodEnd: "2024-01-31",
  items: [
    {description: "Base Package (50h)", amount: 500.00},
    {description: "Additional Concurrent Agents (4)", amount: 400.00},
    {description: "Call Minutes Overage", amount: callMinutesCost},
    {description: "SMS Messages (150)", amount: smsCost},
    {description: "WhatsApp Messages (75)", amount: whatsappCost}
  ],
  subtotal: subtotal,
  tax: tax,
  total: total,
  status: "pending"
};
```

**Example Invoice:**
```
Invoice #INV-COMPANY123-0001
Period: Jan 1, 2024 - Jan 31, 2024

Line Items:
- Base Package (50h, 1 agent)          $500.00
- Additional Concurrent Agents (4)     $400.00
- Call Minutes Overage                  $45.00
- SMS Messages (150)                    $15.00
- WhatsApp Messages (75)                $7.50
                                     -----------
Subtotal                               $967.50
Tax (10%)                               $96.75
                                     -----------
TOTAL                                $1,064.25
```

---

## 🔔 Automatic Alerts

### 80% Usage Alert
When package reaches 80% usage (e.g., 2400/3000 minutes used):

```json
{
  "type": "billing",
  "title": "Minutes Running Low",
  "message": "You have used 80% of your package minutes.",
  "priority": "high"
}
```

### Concurrent Limit Reached
When company tries to start call but max concurrent reached:

```json
{
  "type": "alert",
  "title": "Concurrent Agents Limit Reached",
  "message": "You have reached your maximum of 5 concurrent agents. Upgrade to handle more simultaneous calls.",
  "priority": "high"
}
```

---

## 📈 Usage Summary API

**Get Usage Summary:**
```bash
GET /api/billing/usage/company-123/summary?startDate=2024-01-01&endDate=2024-01-31
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalCost": 467.50,
    "byType": {
      "call_minutes": {
        "count": 234,
        "quantity": 3500,
        "cost": 400.00
      },
      "concurrent_agent": {
        "count": 1,
        "quantity": 4,
        "cost": 400.00
      },
      "sms": {
        "count": 150,
        "cost": 15.00
      },
      "whatsapp": {
        "count": 75,
        "cost": 7.50
      }
    }
  }
}
```

---

## 🔄 Workflow Example: Company Onboarding

### Day 1: Company Signs Up
```bash
# 1. Create company
POST /api/admin/companies
{
  "name": "ACME Corp",
  "maxConcurrentAgents": 1,
  "currentConcurrentAgents": 0
}

# 2. Purchase base package
POST /api/billing/packages
{
  "companyId": "acme-corp",
  "minutesIncluded": 3000,
  "concurrentAgentsIncluded": 1,
  "totalPrice": 500
}
```

**Result:** ACME Corp has 3000 minutes and 1 concurrent agent.

---

### Week 1: Traffic Increases
ACME Corp gets more customers and needs 3 concurrent agents:

```bash
POST /api/billing/concurrent-agents/update
{
  "companyId": "acme-corp",
  "newLimit": 3,
  "pricePerAgent": 100
}
```

**Result:** 
- Max concurrent: 1 → 3
- Additional cost: $200 (2 × $100)
- Usage log created

---

### Week 3: High Call Volume
ACME Corp makes 2500 minutes of calls in 3 weeks:

```bash
# Each call logs usage
POST /api/billing/usage/call
{
  "companyId": "acme-corp",
  "durationMinutes": 15
}
```

**When 80% reached (2400 min):**
```json
Notification: {
  "title": "Minutes Running Low",
  "message": "You have used 80% of your package minutes.",
  "priority": "high"
}
```

---

### End of Month: Invoice Generation
```bash
POST /api/billing/invoices/generate
{
  "companyId": "acme-corp",
  "periodStart": "2024-01-01",
  "periodEnd": "2024-01-31"
}
```

**Invoice:**
```
Base Package:                 $500.00
Additional Agents (2):        $200.00
Call Overage (200 min):        $34.00
SMS (50):                       $5.00
                           ------------
TOTAL:                        $739.00
```

---

## 🎛️ Database Schema

### Package Model
```prisma
model Package {
  id                       String   @id @default(cuid())
  companyId                String
  name                     String
  type                     String   // "minutes", "sms", "whatsapp"
  minutesIncluded          Int      @default(0)
  minutesUsed              Int      @default(0)
  minutesRemaining         Int      @default(0)
  concurrentAgentsIncluded Int      @default(1)
  pricePerMinute           Float    @default(0)
  pricePerAgent            Float    @default(0)
  totalPrice               Float
  billingCycle             String   // "monthly", "yearly", "one_time"
  status                   String   @default("active")
  purchasedAt              DateTime @default(now())
  expiresAt                DateTime?
  createdAt                DateTime @default(now())
  
  company                  Company  @relation(fields: [companyId], references: [id])
  usage                    UsageLog[]
}
```

### UsageLog Model
```prisma
model UsageLog {
  id          String   @id @default(cuid())
  companyId   String
  packageId   String?
  callId      String?
  type        String   // "call_minutes", "concurrent_agent", "sms", "whatsapp"
  quantity    Int
  cost        Float    @default(0)
  description String?
  metadata    Json?
  createdAt   DateTime @default(now())
  
  company     Company  @relation(fields: [companyId], references: [id])
  package     Package? @relation(fields: [packageId], references: [id])
}
```

### Company Model (Updated)
```prisma
model Company {
  id                       String   @id @default(cuid())
  name                     String
  maxConcurrentAgents      Int      @default(1)
  currentConcurrentAgents  Int      @default(0)
  minutesAllocated         Int      @default(0)
  minutesUsed              Int      @default(0)
  subscriptionStatus       String   @default("trial")
  billingEmail             String?
  
  packages                 Package[]
  usageLogs                UsageLog[]
  invoices                 Invoice[]
}
```

---

## 🚀 Quick Start

### Install Dependencies
```bash
cd services/billing-service
npm install
```

### Run Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
npm start
```

### Docker
```bash
docker build -t billing-service .
docker run -p 3015:3015 billing-service
```

---

## 📚 API Documentation

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/billing/packages` | POST | Create/purchase package |
| `/billing/packages/:companyId` | GET | Get company packages |
| `/billing/packages/:companyId/active` | GET | Get active package |
| `/billing/concurrent-agents/update` | POST | Update concurrent limit |
| `/billing/concurrent-agents/check` | POST | Check if can start call |
| `/billing/concurrent-agents/increment` | POST | Increment active count |
| `/billing/concurrent-agents/decrement` | POST | Decrement active count |
| `/billing/usage/call` | POST | Log call minutes usage |
| `/billing/usage/:companyId/summary` | GET | Usage summary |
| `/billing/usage/:companyId` | GET | Usage logs |
| `/billing/invoices/generate` | POST | Generate invoice |
| `/billing/invoices/:companyId` | GET | Get invoices |
| `/billing/invoices/:invoiceId/pay` | POST | Mark invoice paid |
| `/health` | GET | Health check |

---

## 🧪 Testing Examples

### Test Concurrent Agent Scaling
```bash
# Start with 1 agent
curl -X POST http://localhost:3015/billing/concurrent-agents/check \
  -H "Content-Type: application/json" \
  -d '{"companyId":"test-company"}'

# Upgrade to 5 agents
curl -X POST http://localhost:3015/billing/concurrent-agents/update \
  -H "Content-Type: application/json" \
  -d '{
    "companyId":"test-company",
    "newLimit":5,
    "pricePerAgent":100
  }'

# Check updated limit
curl -X POST http://localhost:3015/billing/concurrent-agents/check \
  -H "Content-Type: application/json" \
  -d '{"companyId":"test-company"}'
```

---

## 💡 Best Practices

1. **Always Check Limits Before Calls**
   - Call `/concurrent-agents/check` before initiating calls
   - Show upgrade prompt if `needsUpgrade: true`

2. **Increment/Decrement Properly**
   - Increment when call starts
   - Decrement when call ends
   - Handle edge cases (crashes, timeouts)

3. **Generate Invoices Monthly**
   - Schedule cron job on 1st of month
   - Generate invoices for previous month
   - Send email notifications

4. **Monitor Usage Logs**
   - Check for anomalies in usage patterns
   - Alert for sudden spikes
   - Track cost trends

5. **Handle Package Expiration**
   - Check `expiresAt` date
   - Prevent calls when package expired
   - Prompt for renewal

---

## 🔒 Security

- ✅ All endpoints require authentication (via API Gateway)
- ✅ Company ID validated for authorization
- ✅ Usage logs are immutable (no updates/deletes)
- ✅ Invoice generation is idempotent
- ✅ Concurrent limits prevent abuse

---

## 📞 Support

For questions or issues:
- Email: billing@yourplatform.com
- Documentation: https://docs.yourplatform.com/billing
- Status: https://status.yourplatform.com

---

## 📝 License

Proprietary - All Rights Reserved
