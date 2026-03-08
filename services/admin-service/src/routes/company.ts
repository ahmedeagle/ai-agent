import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const router = Router();
const prisma = new PrismaClient();

// Get company settings
router.get('/:id', async (req, res) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.params.id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true
          }
        },
        agents: true
      }
    });

    res.json({ success: true, data: company });
  } catch (error) {
    res.status(404).json({ success: false, error: 'Company not found' });
  }
});

// Update company settings
router.put('/:id', async (req, res) => {
  try {
    const company = await prisma.company.update({
      where: { id: req.params.id },
      data: req.body
    });

    res.json({ success: true, data: company });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Failed to update company' });
  }
});

// Get company webhooks
router.get('/:id/webhooks', async (req, res) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.params.id },
      select: {
        webhookUrl: true,
        webhookSecret: true,
        webhookEvents: true,
      }
    });

    if (!company) {
      return res.status(404).json({ success: false, error: 'Company not found' });
    }

    res.json({
      success: true,
      data: {
        url: company.webhookUrl || '',
        secret: company.webhookSecret ? '••••••••' : '',
        events: company.webhookEvents || ['call.completed', 'call.failed', 'escalation'],
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch webhooks' });
  }
});

// Update company webhooks
router.put('/:id/webhooks', async (req, res) => {
  try {
    const { url, secret, events } = req.body;

    const company = await prisma.company.update({
      where: { id: req.params.id },
      data: {
        webhookUrl: url,
        webhookSecret: secret,
        webhookEvents: events,
      }
    });

    res.json({ success: true, data: company });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update webhooks' });
  }
});

// Test integration connection
router.post('/:id/test-integration', async (req, res) => {
  try {
    const { type, config } = req.body;
    const companyId = req.params.id;

    // Load company data to get saved credentials if config not provided
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return res.status(404).json({ success: false, error: 'Company not found' });
    }

    let result: any = { success: false };

    switch (type) {
      case 'twilio': {
        try {
          const sid = config?.accountSid || company.twilioAccountSid;
          const token = config?.authToken || company.twilioAuthToken;
          if (!sid || !token) {
            result = { success: false, message: 'Twilio credentials not configured. Save your Account SID and Auth Token first.' };
            break;
          }
          const response = await axios.get('https://api.twilio.com/2010-04-01/Accounts.json', {
            auth: { username: sid, password: token }
          });
          result = { success: true, message: 'Twilio connection successful' };
        } catch (e) {
          result = { success: false, message: 'Invalid Twilio credentials' };
        }
        break;
      }
      case 'whatsapp': {
        try {
          const phoneId = config?.phoneNumberId || company.whatsappPhoneId;
          const token = config?.accessToken || company.whatsappToken;
          if (!phoneId || !token) {
            result = { success: false, message: 'WhatsApp credentials not configured. Save your Phone Number ID and Access Token first.' };
            break;
          }
          const response = await axios.get(
            `https://graph.facebook.com/v18.0/${phoneId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          result = { success: true, message: 'WhatsApp connection successful' };
        } catch (e) {
          result = { success: false, message: 'Invalid WhatsApp credentials' };
        }
        break;
      }
      case 'openai': {
        try {
          const apiKey = config?.apiKey || company.openaiApiKey || process.env.OPENAI_API_KEY;
          if (!apiKey) {
            result = { success: false, message: 'OpenAI API key not configured.' };
            break;
          }
          const response = await axios.get('https://api.openai.com/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` }
          });
          result = { success: true, message: 'OpenAI connection successful' };
        } catch (e) {
          result = { success: false, message: 'Invalid OpenAI API key' };
        }
        break;
      }
      case 'smtp': {
        const host = config?.host || company.smtpHost;
        const port = config?.port || company.smtpPort;
        const smtpUser = config?.user || company.smtpUser;
        const pass = config?.pass || company.smtpPassword;
        if (host && port && smtpUser && pass) {
          result = { success: true, message: 'SMTP config looks valid. Send a test email to verify.' };
        } else {
          result = { success: false, message: 'Missing required SMTP fields. Save your SMTP configuration first.' };
        }
        break;
      }
      default:
        result = { success: false, message: `Unknown integration type: ${type}` };
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Integration test failed' });
  }
});

export default router;
