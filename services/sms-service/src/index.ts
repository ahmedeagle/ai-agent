import express from 'express';
import { PrismaClient } from '@prisma/client';
import twilio from 'twilio';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.SMS_SERVICE_PORT || 3011;

// Helper: get the "from" phone number with env fallback
function getFromNumber(company: any): string {
  const from = company?.twilioPhoneNumber || process.env.TWILIO_PHONE_NUMBER;
  if (!from) throw new Error('No Twilio phone number configured. Set it in Integrations or .env TWILIO_PHONE_NUMBER');
  return from;
}

// Lazy Twilio init - only create client when credentials exist
function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token || !sid.startsWith('AC')) {
    console.warn('Twilio credentials not configured - SMS features disabled');
    return null;
  }
  return twilio(sid, token);
}

// Get per-company Twilio client (falls back to system default)
async function getCompanyTwilioClient(companyId: string) {
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { twilioAccountSid: true, twilioAuthToken: true }
    });

    if (company?.twilioAccountSid && company?.twilioAuthToken) {
      return twilio(company.twilioAccountSid, company.twilioAuthToken);
    }
  } catch (error) {
    console.error('Error fetching company Twilio credentials:', error);
  }
  
  // Fall back to system default
  return getTwilioClient();
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============ SMS SENDING ============

// Send SMS message
app.post('/sms/send', async (req, res) => {
  try {
    const {
      to,
      body,
      companyId,
      customerId,
      callId,
      type,
      scheduledFor
    } = req.body;

    // Get company's Twilio number
    const company = await prisma.company.findUnique({
      where: {id: companyId}
    });

    if (!company) {
      throw new Error('Company not found');
    }

    const from = getFromNumber(company);
    if (!from) {
      throw new Error('No Twilio phone number configured. Set it in Integrations or .env TWILIO_PHONE_NUMBER');
    }

    if (scheduledFor) {
      // Schedule for later
      const message = await prisma.sMSMessage.create({
        data: {
          to,
          from,
          body,
          companyId,
          customerId,
          callId,
          type: type || 'manual',
          status: 'scheduled',
          scheduledFor: new Date(scheduledFor)
        }
      });

      res.json({success: true, data: message, scheduled: true});
    } else {
      // Send immediately
      const companyTwilio = await getCompanyTwilioClient(companyId);
      const twilioMessage = await companyTwilio.messages.create({
        body,
        to,
        from
      });

      const message = await prisma.sMSMessage.create({
        data: {
          to,
          from,
          body,
          companyId,
          customerId,
          callId,
          type: type || 'manual',
          status: 'sent',
          twilioSid: twilioMessage.sid,
          sentAt: new Date()
        }
      });

      res.json({success: true, data: message});
    }
  } catch (error: any) {
    console.error('SMS send error:', error);
    res.status(500).json({success: false, error: error.message});
  }
});

// Send appointment reminder
app.post('/sms/reminder', async (req, res) => {
  try {
    const {
      customerId,
      appointmentDate,
      appointmentTime,
      confirmLink
    } = req.body;

    const customer = await prisma.customer.findUnique({
      where: {id: customerId},
      include: {company: true}
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    const body = `Reminder: You have an appointment on ${appointmentDate} at ${appointmentTime}. ${confirmLink ? `Confirm here: ${confirmLink}` : 'Reply YES to confirm.'}`;

    const companyTwilio = await getCompanyTwilioClient(customer.companyId);
    const reminderFrom = getFromNumber(customer.company);
    const twilioMessage = await companyTwilio.messages.create({
      body,
      to: customer.phone,
      from: reminderFrom
    });

    const message = await prisma.sMSMessage.create({
      data: {
        to: customer.phone,
        from: reminderFrom,
        body,
        companyId: customer.companyId,
        customerId: customer.id,
        type: 'reminder',
        status: 'sent',
        twilioSid: twilioMessage.sid,
        sentAt: new Date()
      }
    });

    res.json({success: true, data: message});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Send call summary
app.post('/sms/call-summary', async (req, res) => {
  try {
    const {callId} = req.body;

    const call = await prisma.call.findUnique({
      where: {id: callId},
      include: {
        company: true,
        customer: true
      }
    });

    if (!call) {
      throw new Error('Call not found');
    }

    const body = `Thank you for calling ${call.company.name}. Call duration: ${Math.round(call.duration / 60)} min. ${call.transcriptUrl ? `Transcript: ${call.transcriptUrl}` : ''} ${call.recordingUrl ? `Recording: ${call.recordingUrl}` : ''}`;

    const companyTwilio = await getCompanyTwilioClient(call.companyId);
    const summaryFrom = getFromNumber(call.company);
    const twilioMessage = await companyTwilio.messages.create({
      body,
      to: call.phoneNumber,
      from: summaryFrom
    });

    const message = await prisma.sMSMessage.create({
      data: {
        to: call.phoneNumber,
        from: summaryFrom,
        body,
        companyId: call.companyId,
        customerId: call.customerId,
        callId: call.id,
        type: 'call_summary',
        status: 'sent',
        twilioSid: twilioMessage.sid,
        sentAt: new Date()
      }
    });

    res.json({success: true, data: message});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Send 2FA/OTP code
app.post('/sms/otp', async (req, res) => {
  try {
    const {to, companyId, code} = req.body;

    const company = await prisma.company.findUnique({
      where: {id: companyId}
    });

    if (!company) {
      throw new Error('Company not found');
    }

    const body = `Your verification code is: ${code}. This code will expire in 10 minutes.`;

    const companyTwilio = await getCompanyTwilioClient(companyId);
    const otpFrom = getFromNumber(company);
    const twilioMessage = await companyTwilio.messages.create({
      body,
      to,
      from: otpFrom
    });

    const message = await prisma.sMSMessage.create({
      data: {
        to,
        from: otpFrom,
        body,
        companyId,
        type: 'otp',
        status: 'sent',
        twilioSid: twilioMessage.sid,
        sentAt: new Date()
      }
    });

    res.json({success: true, data: message});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ SMS RECEIVING (WEBHOOK) ============

// Twilio webhook - incoming SMS
app.post('/sms/webhook', async (req, res) => {
  try {
    const {MessageSid, From, To, Body} = req.body;

    // Find company by phone number (check DB first, then env fallback)
    let company = await prisma.company.findFirst({
      where: {twilioPhoneNumber: To}
    });

    // If not found by DB phone number, check if To matches system default
    if (!company && To === process.env.TWILIO_PHONE_NUMBER) {
      company = await prisma.company.findFirst();
    }

    if (!company) {
      throw new Error('Company not found for number');
    }

    // Find or create customer
    let customer = await prisma.customer.findFirst({
      where: {phone: From, companyId: company.id}
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          phone: From,
          companyId: company.id,
          source: 'sms'
        }
      });
    }

    // Save incoming message
    const message = await prisma.sMSMessage.create({
      data: {
        to: To,
        from: From,
        body: Body,
        companyId: company.id,
        customerId: customer.id,
        type: 'inbound',
        status: 'received',
        twilioSid: MessageSid,
        receivedAt: new Date()
      }
    });

    // Process message content
    const bodyLower = Body.toLowerCase().trim();

    let response = '';

    // Appointment confirmation
    if (bodyLower === 'yes' || bodyLower === 'confirm' || bodyLower === 'y') {
      response = 'Your appointment has been confirmed. We look forward to speaking with you!';
    }
    // Opt-out handling
    else if (bodyLower === 'stop' || bodyLower === 'unsubscribe') {
      await prisma.customer.update({
        where: {id: customer.id},
        data: {smsOptOut: true}
      });
      response = 'You have been unsubscribed from SMS messages. Reply START to resubscribe.';
    }
    // Opt-in handling
    else if (bodyLower === 'start' || bodyLower === 'subscribe') {
      await prisma.customer.update({
        where: {id: customer.id},
        data: {smsOptOut: false}
      });
      response = 'You have been subscribed to SMS messages. Reply STOP to unsubscribe.';
    }
    // Help
    else if (bodyLower === 'help' || bodyLower === '?') {
      response = `${company.name} - Reply YES to confirm appointments, STOP to unsubscribe, or call us at ${company.twilioPhoneNumber} for immediate assistance.`;
    }
    // Forward to AI for processing
    else {
      try {
        const aiResponse = await axios.post(`${process.env.AI_ENGINE_URL}/process-text`, {
          text: Body,
          customerId: customer.id,
          companyId: company.id
        });
        response = aiResponse.data.reply || 'Thank you for your message. We will get back to you shortly.';
      } catch (error) {
        response = 'Thank you for your message. We will get back to you shortly.';
      }
    }

    // Send response
    const companyTwilio = await getCompanyTwilioClient(company.id);
    const twilioResponse = await companyTwilio.messages.create({
      body: response,
      to: From,
      from: To
    });

    await prisma.sMSMessage.create({
      data: {
        to: From,
        from: To,
        body: response,
        companyId: company.id,
        customerId: customer.id,
        type: 'outbound',
        status: 'sent',
        twilioSid: twilioResponse.sid,
        sentAt: new Date()
      }
    });

    // TwiML response (required by Twilio)
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
  } catch (error: any) {
    console.error('SMS webhook error:', error);
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ SMS STATUS UPDATES (WEBHOOK) ============

// Twilio status callback
app.post('/sms/status', async (req, res) => {
  try {
    const {MessageSid, MessageStatus, ErrorCode} = req.body;

    await prisma.sMSMessage.updateMany({
      where: {twilioSid: MessageSid},
      data: {
        status: MessageStatus,
        error: ErrorCode ? `Error: ${ErrorCode}` : null
      }
    });

    res.sendStatus(200);
  } catch (error: any) {
    console.error('SMS status error:', error);
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ SMS HISTORY & ANALYTICS ============

// Get all SMS messages for a company
app.get('/sms/messages/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { limit = 50, offset = 0/*, search*/ } = req.query;

    const messages = await prisma.sMSMessage.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    res.json({ success: true, data: messages });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get SMS stats for a company (aggregate counts by status)
app.get('/sms/stats/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;

    const messages = await prisma.sMSMessage.findMany({ where: { companyId } });

    const stats = {
      totalSent: messages.filter(m => ['sent', 'delivered', 'failed'].includes(m.status)).length,
      delivered: messages.filter(m => m.status === 'delivered').length,
      failed: messages.filter(m => m.status === 'failed').length,
      scheduled: messages.filter(m => m.status === 'scheduled').length,
    };

    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get SMS history for customer
app.get('/sms/customer/:customerId', async (req, res) => {
  try {
    const {customerId} = req.params;
    const {limit = 50, offset = 0} = req.query;

    const messages = await prisma.sMSMessage.findMany({
      where: {customerId},
      orderBy: {createdAt: 'desc'},
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    res.json({success: true, data: messages});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Get SMS analytics for company
app.get('/sms/analytics/:companyId', async (req, res) => {
  try {
    const {companyId} = req.params;
    const {startDate, endDate} = req.query;

    const where: any = {companyId};
    if (startDate || endDate) {
      where.createdAt = {
        gte: startDate ? new Date(startDate as string) : undefined,
        lte: endDate ? new Date(endDate as string) : undefined
      };
    }

    const messages = await prisma.sMSMessage.findMany({where});

    const analytics = {
      total: messages.length,
      sent: messages.filter(m => m.type === 'outbound').length,
      received: messages.filter(m => m.type === 'inbound').length,
      byType: {
        manual: messages.filter(m => m.type === 'manual').length,
        reminder: messages.filter(m => m.type === 'reminder').length,
        call_summary: messages.filter(m => m.type === 'call_summary').length,
        otp: messages.filter(m => m.type === 'otp').length,
        inbound: messages.filter(m => m.type === 'inbound').length,
        outbound: messages.filter(m => m.type === 'outbound').length
      },
      byStatus: {
        sent: messages.filter(m => m.status === 'sent').length,
        delivered: messages.filter(m => m.status === 'delivered').length,
        failed: messages.filter(m => m.status === 'failed').length,
        scheduled: messages.filter(m => m.status === 'scheduled').length
      },
      deliveryRate: messages.filter(m => m.status === 'delivered').length / messages.length * 100
    };

    res.json({success: true, data: analytics});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ SCHEDULED SMS PROCESSOR ============

// Process scheduled messages (run via cron)
app.post('/sms/process-scheduled', async (req, res) => {
  try {
    const now = new Date();

    const scheduled = await prisma.sMSMessage.findMany({
      where: {
        status: 'scheduled',
        scheduledFor: {lte: now}
      },
      include: {company: true}
    });

    const results = [];

    for (const message of scheduled) {
      try {
        const scheduledTwilio = await getCompanyTwilioClient(message.companyId);
        const twilioMessage = await scheduledTwilio.messages.create({
          body: message.body,
          to: message.to,
          from: message.from
        });

        await prisma.sMSMessage.update({
          where: {id: message.id},
          data: {
            status: 'sent',
            twilioSid: twilioMessage.sid,
            sentAt: new Date()
          }
        });

        results.push({id: message.id, status: 'sent'});
      } catch (error: any) {
        await prisma.sMSMessage.update({
          where: {id: message.id},
          data: {
            status: 'failed',
            error: error.message
          }
        });

        results.push({id: message.id, status: 'failed', error: error.message});
      }
    }

    res.json({success: true, processed: results.length, results});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'sms-service',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`💬 SMS Service running on port ${PORT}`);
});

export default app;
