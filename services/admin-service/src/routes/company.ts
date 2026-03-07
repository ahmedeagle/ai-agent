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

    let result: any = { success: false };

    switch (type) {
      case 'twilio': {
        // Test Twilio credentials
        try {
          const response = await axios.get('https://api.twilio.com/2010-04-01/Accounts.json', {
            auth: {
              username: config.accountSid,
              password: config.authToken
            }
          });
          result = { success: true, message: 'Twilio connection successful' };
        } catch (e) {
          result = { success: false, message: 'Invalid Twilio credentials' };
        }
        break;
      }
      case 'whatsapp': {
        try {
          const response = await axios.get(
            `https://graph.facebook.com/v18.0/${config.phoneNumberId}`,
            { headers: { Authorization: `Bearer ${config.accessToken}` } }
          );
          result = { success: true, message: 'WhatsApp connection successful' };
        } catch (e) {
          result = { success: false, message: 'Invalid WhatsApp credentials' };
        }
        break;
      }
      case 'openai': {
        try {
          const response = await axios.get('https://api.openai.com/v1/models', {
            headers: { Authorization: `Bearer ${config.apiKey}` }
          });
          result = { success: true, message: 'OpenAI connection successful' };
        } catch (e) {
          result = { success: false, message: 'Invalid OpenAI API key' };
        }
        break;
      }
      case 'smtp': {
        // Basic SMTP test (verify we have the fields)
        if (config.host && config.port && config.user && config.pass) {
          result = { success: true, message: 'SMTP config looks valid. Send a test email to verify.' };
        } else {
          result = { success: false, message: 'Missing required SMTP fields' };
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
