# 📡 API Reference Guide

Complete API documentation for all services in the AI Agent Call Center Platform.

## Table of Contents
- [Transfer Service](#transfer-service-port-3009)
- [IVR Service](#ivr-service-port-3010)
- [SMS Service](#sms-service-port-3011)
- [Sentiment Service](#sentiment-service-port-3012)
- [Email Service](#email-service-port-3013)
- [WhatsApp Service](#whatsapp-service-port-3014)

---

## Transfer Service (Port 3009)

### Get Available Agents
Find human agents available for transfer based on skills and language.

```http
GET /agents/available?skills=sales,support&language=en&limit=10
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "agent-123",
      "name": "John Doe",
      "skills": ["sales", "support"],
      "languages": ["en", "es"],
      "currentCalls": 1,
      "maxConcurrentCalls": 3,
      "status": "available"
    }
  ]
}
```

### Update Agent Status
```http
PUT /agents/:agentId/status
Content-Type: application/json

{
  "status": "available",  // available, busy, break, offline
  "maxConcurrentCalls": 3
}
```

### Initiate Transfer
```http
POST /transfer/initiate
Content-Type: application/json

{
  "callId": "call-123",
  "agentId": "agent-456",  // Optional for auto-assignment
  "type": "warm",  // warm, cold, voicemail
  "reason": "customer_request",
  "notes": "Customer needs help with billing"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "transfer-789",
    "callId": "call-123",
    "agentId": "agent-456",
    "type": "warm",
    "status": "pending",
    "briefing": "Customer John has billing question...",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### Accept Transfer (Warm Transfer)
```http
POST /transfer/:transferId/accept
```

### Reject Transfer
```http
POST /transfer/:transferId/reject
Content-Type: application/json

{
  "reason": "not_available"
}
```

### Complete Transfer
```http
POST /transfer/:transferId/complete
Content-Type: application/json

{
  "outcome": "resolved",
  "notes": "Issue resolved successfully"
}
```

### Auto-Escalation Evaluation
```http
POST /transfer/evaluate-escalation
Content-Type: application/json

{
  "callId": "call-123",
  "reason": "negative_sentiment",
  "sentiment": {
    "score": -0.8,
    "urgency": "high"
  }
}
```

---

## IVR Service (Port 3010)

### Create IVR Menu
```http
POST /ivr/menu
Content-Type: application/json

{
  "name": "Main Menu",
  "companyId": "company-123",
  "entryPrompt": "Press 1 for Sales, 2 for Support, 3 for Billing, 0 for operator",
  "language": "en",
  "timeout": 5,
  "maxRetries": 3,
  "options": [
    {
      "key": "1",
      "label": "Sales",
      "action": "route_agent",
      "target": "sales-agent-id"
    },
    {
      "key": "2",
      "label": "Support",
      "action": "route_agent",
      "target": "support-agent-id"
    },
    {
      "key": "3",
      "label": "Billing",
      "action": "route_human",
      "target": "billing"
    },
    {
      "key": "0",
      "label": "Operator",
      "action": "route_human",
      "target": "general"
    }
  ]
}
```

**Action Types:**
- `route_agent` - Route to AI agent (target: agentId)
- `route_human` - Route to human agent (target: skill)
- `submenu` - Navigate to submenu (target: menuId)
- `voicemail` - Leave voicemail
- `callback` - Schedule callback
- `language` - Switch language (target: language code)

### Get IVR Menu
```http
GET /ivr/menu/:menuId
```

### Update IVR Menu
```http
PUT /ivr/menu/:menuId
Content-Type: application/json

{
  "entryPrompt": "Updated prompt...",
  "active": true
}
```

### Twilio Entry Webhook (DO NOT CALL DIRECTLY)
```http
POST /ivr/entry/:companyId
```
This is called by Twilio when a call comes in.

### Get IVR Analytics
```http
GET /ivr/analytics/:companyId?startDate=2024-01-01&endDate=2024-01-31
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "menuId": "menu-123",
      "menuName": "Main Menu",
      "totalSessions": 1500,
      "completedSessions": 1350,
      "completionRate": 90,
      "selectionCounts": {
        "1": 600,
        "2": 500,
        "3": 200,
        "0": 50
      },
      "avgRetries": 0.3
    }
  ]
}
```

---

## SMS Service (Port 3011)

### Send SMS
```http
POST /sms/send
Content-Type: application/json

{
  "to": "+1234567890",
  "body": "Your appointment is confirmed for tomorrow at 2 PM.",
  "companyId": "company-123",
  "customerId": "customer-456",
  "type": "reminder",  // manual, reminder, call_summary, otp
  "scheduledFor": "2024-01-16T14:00:00Z"  // Optional
}
```

### Send Appointment Reminder
```http
POST /sms/reminder
Content-Type: application/json

{
  "customerId": "customer-123",
  "appointmentDate": "January 16, 2024",
  "appointmentTime": "2:00 PM",
  "confirmLink": "https://yourapp.com/confirm/abc123"
}
```

### Send Call Summary
```http
POST /sms/call-summary
Content-Type: application/json

{
  "callId": "call-123"
}
```

### Send OTP
```http
POST /sms/otp
Content-Type: application/json

{
  "to": "+1234567890",
  "companyId": "company-123",
  "code": "123456"
}
```

### Twilio SMS Webhook (DO NOT CALL DIRECTLY)
```http
POST /sms/webhook
```

### Get SMS History
```http
GET /sms/customer/:customerId?limit=50&offset=0
```

### Get SMS Analytics
```http
GET /sms/analytics/:companyId?startDate=2024-01-01&endDate=2024-01-31
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 5000,
    "sent": 2500,
    "received": 2500,
    "byType": {
      "manual": 500,
      "reminder": 1000,
      "call_summary": 800,
      "otp": 200,
      "inbound": 2500,
      "outbound": 2500
    },
    "deliveryRate": 98.5
  }
}
```

---

## Sentiment Service (Port 3012)

### Analyze Sentiment
```http
POST /sentiment/analyze
Content-Type: application/json

{
  "text": "I'm very frustrated with this service. Nothing is working!",
  "callId": "call-123",  // Optional
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sentiment": "negative",
    "score": -0.85,
    "emotions": ["frustration", "anger"],
    "urgency": "high",
    "escalation": true,
    "concerns": ["service quality", "functionality issues"],
    "logId": "log-123"
  }
}
```

### Batch Analysis
```http
POST /sentiment/analyze-batch
Content-Type: application/json

{
  "callId": "call-123",
  "messages": [
    {"index": 0, "text": "Hello, how can I help?", "timestamp": "..."},
    {"index": 1, "text": "I'm having issues", "timestamp": "..."},
    {"index": 2, "text": "This is frustrating", "timestamp": "..."}
  ]
}
```

### Get Real-time Sentiment
```http
GET /sentiment/call/:callId/realtime?lastN=10
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sentiment": "negative",
    "score": -0.6,
    "recentScore": -0.8,
    "trend": "declining",
    "logs": [...]
  }
}
```

### Get Sentiment History
```http
GET /sentiment/call/:callId
```

### Manual Escalation
```http
POST /sentiment/escalate/:callId
Content-Type: application/json

{
  "reason": "customer_angry",
  "notes": "Customer very upset about billing"
}
```

### Get Sentiment Analytics
```http
GET /sentiment/analytics/:companyId?startDate=2024-01-01&endDate=2024-01-31
```

---

## Email Service (Port 3013)

### Send Email
```http
POST /email/send
Content-Type: application/json

{
  "to": "customer@example.com",
  "subject": "Your Call Summary",
  "template": "callSummary",  // callSummary, transcript, voicemail, notification
  "data": {
    "callDate": "January 15, 2024",
    "duration": 5,
    "status": "completed",
    "summary": "We discussed your account issue...",
    "transcriptUrl": "https://...",
    "recordingUrl": "https://..."
  },
  "companyId": "company-123",
  "customerId": "customer-456",
  "callId": "call-789",
  "attachments": [
    {
      "filename": "transcript.pdf",
      "url": "https://...",
      "contentType": "application/pdf"
    }
  ]
}
```

### Send Call Summary
```http
POST /email/call-summary
Content-Type: application/json

{
  "callId": "call-123"
}
```

### Send Transcript
```http
POST /email/transcript
Content-Type: application/json

{
  "callId": "call-123",
  "to": "customer@example.com"
}
```

### Send Voicemail Notification
```http
POST /email/voicemail
Content-Type: application/json

{
  "voicemailId": "vm-123",
  "to": "agent@company.com"
}
```

### Send Custom Notification
```http
POST /email/notification
Content-Type: application/json

{
  "to": "manager@company.com",
  "title": "Urgent: Escalation Required",
  "message": "Call with customer John requires immediate attention.",
  "companyId": "company-123",
  "urgent": true,
  "actionUrl": "https://dashboard.com/calls/123",
  "actionText": "View Call",
  "details": [
    {"label": "Customer", "value": "John Doe"},
    {"label": "Sentiment", "value": "Very Negative"}
  ]
}
```

### Get Email History
```http
GET /email/history/:companyId?limit=50&offset=0
```

### Get Email Analytics
```http
GET /email/analytics/:companyId?startDate=2024-01-01&endDate=2024-01-31
```

---

## WhatsApp Service (Port 3014)

### Send Message
```http
POST /whatsapp/send
Content-Type: application/json

{
  "to": "14155238886",  // WhatsApp phone number (no + prefix)
  "text": "Thank you for contacting us!",
  "companyId": "company-123",
  "customerId": "customer-456"
}
```

### Send Template Message
```http
POST /whatsapp/send-template
Content-Type: application/json

{
  "to": "14155238886",
  "templateName": "appointment_reminder",
  "language": "en",
  "components": [
    {
      "type": "body",
      "parameters": [
        {"type": "text", "text": "John"},
        {"type": "text", "text": "January 16 at 2:00 PM"}
      ]
    }
  ]
}
```

### Send Media
```http
POST /whatsapp/send-media
Content-Type: application/json

{
  "to": "14155238886",
  "mediaType": "image",  // image, video, audio, document
  "mediaUrl": "https://example.com/image.jpg",
  "caption": "Here's your receipt"
}
```

### Get Conversation History
```http
GET /whatsapp/conversation/:customerId?limit=50
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "msg-123",
      "whatsappMessageId": "wamid.xxx",
      "from": "14155238886",
      "to": "your-wa-number",
      "body": "Hello, I need help",
      "messageType": "text",
      "direction": "inbound",
      "status": "received",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Webhook Verification (DO NOT CALL DIRECTLY)
```http
GET /whatsapp/webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
```

### Webhook for Incoming Messages (DO NOT CALL DIRECTLY)
```http
POST /whatsapp/webhook
```

### Get WhatsApp Analytics
```http
GET /whatsapp/analytics/:companyId?startDate=2024-01-01&endDate=2024-01-31
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 10000,
    "inbound": 5000,
    "outbound": 5000,
    "uniqueCustomers": 2000,
    "byType": {
      "text": 8000,
      "image": 1000,
      "audio": 500,
      "video": 300,
      "document": 200
    },
    "avgResponseTime": 45  // seconds
  }
}
```

---

## Common Patterns

### Error Responses
All services return errors in this format:
```json
{
  "success": false,
  "error": "Error message description"
}
```

### Health Checks
All services expose a health check endpoint:
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "transfer-service",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Pagination
Services that return lists support pagination:
```http
GET /endpoint?limit=50&offset=0
```

### Date Filtering
Analytics endpoints support date filtering:
```http
GET /endpoint/analytics/:id?startDate=2024-01-01&endDate=2024-01-31
```

---

## Webhook Configuration

### Twilio Voice
- **URL:** `https://your-domain.com/ivr/entry/:companyId`
- **Method:** POST
- **Status Callback:** `https://your-domain.com/voice/status`

### Twilio SMS
- **URL:** `https://your-domain.com/sms/webhook`
- **Method:** POST
- **Status Callback:** `https://your-domain.com/sms/status`

### WhatsApp
- **Webhook URL:** `https://your-domain.com/whatsapp/webhook`
- **Verify Token:** Your custom token from .env
- **Method:** POST

---

## Authentication

Most endpoints require JWT authentication:
```http
Authorization: Bearer <your-jwt-token>
```

Get JWT token from the Auth service:
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your-password"
}
```

---

## Rate Limits

Default rate limits per service:
- **Transfer Service:** 100 requests/min per IP
- **IVR Service:** Unlimited (Twilio webhook)
- **SMS Service:** 10 SMS/sec per company
- **Sentiment Service:** 50 requests/min per company
- **Email Service:** 100 emails/hour per company
- **WhatsApp Service:** Subject to WhatsApp Business API limits

---

## Support

For API support:
- Check service health: `GET /health`
- View service logs: `docker-compose logs -f [service-name]`
- API Documentation: http://localhost:3000/docs
