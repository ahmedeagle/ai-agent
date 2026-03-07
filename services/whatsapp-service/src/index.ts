import express from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import dotenv from 'dotenv';
import FormData from 'form-data';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.WHATSAPP_SERVICE_PORT || 3014;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// WhatsApp Business API configuration (system defaults)
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

// ============ HELPER: GET COMPANY WHATSAPP CREDENTIALS ============

async function getCompanyWhatsAppCredentials(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      whatsappPhoneId: true,
      whatsappToken: true
    }
  });

  // Use company-specific credentials if available, otherwise fall back to system defaults
  return {
    phoneId: company?.whatsappPhoneId || WHATSAPP_PHONE_ID,
    token: company?.whatsappToken || WHATSAPP_TOKEN
  };
}

app.use(express.json());

// ============ WHATSAPP WEBHOOK VERIFICATION ============

// Webhook verification (required by Meta)
app.get('/whatsapp/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
    console.log('✅ WhatsApp webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ============ WHATSAPP INCOMING MESSAGES ============

// Webhook for incoming messages
app.post('/whatsapp/webhook', async (req, res) => {
  try {
    const {entry} = req.body;

    if (!entry || !entry[0]?.changes) {
      return res.sendStatus(200);
    }

    const changes = entry[0].changes[0];
    const value = changes?.value;

    if (!value?.messages) {
      return res.sendStatus(200);
    }

    // Process each message
    for (const message of value.messages) {
      await processIncomingMessage(message, value);
    }

    res.sendStatus(200);
  } catch (error: any) {
    console.error('WhatsApp webhook error:', error);
    res.sendStatus(200); // Always return 200 to WhatsApp
  }
});

async function processIncomingMessage(message: any, value: any) {
  try {
    const {from, id: messageId, type, timestamp} = message;

    // Find company by WhatsApp phone
    const company = await prisma.company.findFirst({
      where: {whatsappNumber: value.metadata?.phone_number_id}
    });

    if (!company) {
      console.log('Company not found for WhatsApp number');
      return;
    }

    // Find or create customer
    let customer = await prisma.customer.findFirst({
      where: {phone: from, companyId: company.id}
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          phone: from,
          companyId: company.id,
          source: 'whatsapp'
        }
      });
    }

    // Extract message content
    let messageText = '';
    let mediaUrl = '';
    let mediaType = '';

    switch (type) {
      case 'text':
        messageText = message.text?.body || '';
        break;
      case 'image':
        mediaUrl = await downloadWhatsAppMedia(message.image?.id);
        mediaType = 'image';
        messageText = message.image?.caption || '[Image]';
        break;
      case 'audio':
        mediaUrl = await downloadWhatsAppMedia(message.audio?.id);
        mediaType = 'audio';
        messageText = '[Audio message]';
        break;
      case 'video':
        mediaUrl = await downloadWhatsAppMedia(message.video?.id);
        mediaType = 'video';
        messageText = message.video?.caption || '[Video]';
        break;
      case 'document':
        mediaUrl = await downloadWhatsAppMedia(message.document?.id);
        mediaType = 'document';
        messageText = message.document?.filename || '[Document]';
        break;
      case 'location':
        messageText = `[Location: ${message.location?.latitude}, ${message.location?.longitude}]`;
        break;
      case 'contacts':
        messageText = '[Contact shared]';
        break;
      default:
        messageText = `[${type} message]`;
    }

    // Save incoming message
    await prisma.whatsAppMessage.create({
      data: {
        whatsappMessageId: messageId,
        from,
        to: value.metadata?.display_phone_number,
        body: messageText,
        messageType: type,
        mediaUrl,
        companyId: company.id,
        customerId: customer.id,
        direction: 'inbound',
        status: 'received',
        timestamp: new Date(parseInt(timestamp) * 1000)
      }
    });

    // Mark as read
    await markMessageAsRead(messageId);

    // Process with AI
    const aiResponse = await processWithAI(messageText, customer.id, company.id);

    // Send response
    await sendWhatsAppMessage(from, aiResponse, company.id, customer.id);

  } catch (error) {
    console.error('Error processing WhatsApp message:', error);
  }
}

// ============ AI PROCESSING ============

async function processWithAI(text: string, customerId: string, companyId: string) {
  try {
    // Get customer history
    const customer = await prisma.customer.findUnique({
      where: {id: customerId},
      include: {
        whatsappMessages: {
          orderBy: {timestamp: 'desc'},
          take: 10
        }
      }
    });

    // Get company's AI agent
    const agent = await prisma.aiAgent.findFirst({
      where: {companyId, active: true}
    });

    if (!agent) {
      return 'Thank you for your message. Our team will get back to you shortly.';
    }

    // Build conversation history
    const conversationHistory = customer?.whatsappMessages
      .reverse()
      .map(msg => ({
        role: msg.direction === 'inbound' ? 'user' : 'assistant',
        content: msg.body
      })) || [];

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: agent.systemPrompt || 'You are a helpful customer service assistant.'
        },
        ...conversationHistory.slice(-10), // Last 10 messages
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    return completion.choices[0].message.content || 'I apologize, but I need more information to assist you.';
  } catch (error) {
    console.error('AI processing error:', error);
    return 'Thank you for your message. Our team will get back to you shortly.';
  }
}

// ============ SEND WHATSAPP MESSAGES ============

// Send text message
async function sendWhatsAppMessage(to: string, text: string, companyId: string, customerId?: string) {
  try {
    // Get company-specific WhatsApp credentials
    const credentials = await getCompanyWhatsAppCredentials(companyId);

    if (!credentials.phoneId || !credentials.token) {
      throw new Error('WhatsApp credentials not configured for this company');
    }

    const response = await axios.post(
      `${WHATSAPP_API_URL}/${credentials.phoneId}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: {body: text}
      },
      {
        headers: {
          Authorization: `Bearer ${credentials.token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const messageId = response.data.messages[0].id;

    // Save to database
    await prisma.whatsAppMessage.create({
      data: {
        whatsappMessageId: messageId,
        from: credentials.phoneId!,
        to,
        body: text,
        messageType: 'text',
        companyId,
        customerId,
        direction: 'outbound',
        status: 'sent'
      }
    });

    return {success: true, messageId};
  } catch (error: any) {
    console.error('Error sending WhatsApp message:', error.response?.data || error);
    throw error;
  }
}

// Send message with template
async function sendTemplateMessage(to: string, templateName: string, language: string, components: any[], companyId?: string) {
  try {
    const { phoneId, token } = companyId 
      ? await getCompanyWhatsAppCredentials(companyId)
      : { phoneId: WHATSAPP_PHONE_ID, token: WHATSAPP_TOKEN };

    const response = await axios.post(
      `${WHATSAPP_API_URL}/${phoneId}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: {code: language},
          components
        }
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('Error sending template:', error.response?.data || error);
    throw error;
  }
}

// Send media message
async function sendMediaMessage(to: string, mediaType: string, mediaUrl: string, caption?: string, companyId?: string) {
  try {
    const { phoneId, token } = companyId 
      ? await getCompanyWhatsAppCredentials(companyId)
      : { phoneId: WHATSAPP_PHONE_ID, token: WHATSAPP_TOKEN };

    const response = await axios.post(
      `${WHATSAPP_API_URL}/${phoneId}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: mediaType,
        [mediaType]: {
          link: mediaUrl,
          caption
        }
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('Error sending media:', error.response?.data || error);
    throw error;
  }
}

// ============ WHATSAPP API ENDPOINTS ============

// Send message via API
app.post('/whatsapp/send', async (req, res) => {
  try {
    const {to, text, companyId, customerId} = req.body;
    const result = await sendWhatsAppMessage(to, text, companyId, customerId);
    res.json({success: true, data: result});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Send template message
app.post('/whatsapp/send-template', async (req, res) => {
  try {
    const {to, templateName, language, components, companyId} = req.body;
    const result = await sendTemplateMessage(to, templateName, language, components, companyId);
    res.json({success: true, data: result});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Send media
app.post('/whatsapp/send-media', async (req, res) => {
  try {
    const {to, mediaType, mediaUrl, caption, companyId} = req.body;
    const result = await sendMediaMessage(to, mediaType, mediaUrl, caption, companyId);
    res.json({success: true, data: result});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Get conversation history
app.get('/whatsapp/conversation/:customerId', async (req, res) => {
  try {
    const {customerId} = req.params;
    const {limit = 50} = req.query;

    const messages = await prisma.whatsAppMessage.findMany({
      where: {customerId},
      orderBy: {timestamp: 'asc'},
      take: parseInt(limit as string)
    });

    res.json({success: true, data: messages});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Get all WhatsApp conversations for a company (grouped by contact)
app.get('/whatsapp/conversations/:companyId', async (req, res) => {
  try {
    const {companyId} = req.params;

    // Get latest message per unique contact (from number)
    const messages = await prisma.whatsAppMessage.findMany({
      where: {companyId},
      orderBy: {createdAt: 'desc'},
      take: 500,
    });

    // Group by contact (from for inbound, to for outbound)
    const convMap = new Map<string, any>();
    for (const msg of messages) {
      const contact = msg.direction === 'inbound' ? msg.from : msg.to;
      if (!convMap.has(contact)) {
        convMap.set(contact, {
          contact,
          lastMessage: msg.body || '[media]',
          lastMessageAt: msg.createdAt,
          direction: msg.direction,
          status: msg.status,
          unread: 0,
          messageCount: 0,
        });
      }
      const conv = convMap.get(contact)!;
      conv.messageCount++;
      if (msg.direction === 'inbound' && msg.status !== 'read') conv.unread++;
    }

    const conversations = Array.from(convMap.values())
      .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

    res.json({success: true, data: conversations});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Get messages for a specific contact
app.get('/whatsapp/messages/:companyId/:contact', async (req, res) => {
  try {
    const {companyId, contact} = req.params;

    const messages = await prisma.whatsAppMessage.findMany({
      where: {
        companyId,
        OR: [{from: contact}, {to: contact}],
      },
      orderBy: {createdAt: 'asc'},
    });

    res.json({success: true, data: messages});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Get WhatsApp analytics
app.get('/whatsapp/analytics/:companyId', async (req, res) => {
  try {
    const {companyId} = req.params;
    const {startDate, endDate} = req.query;

    const where: any = {companyId};
    if (startDate || endDate) {
      where.timestamp = {
        gte: startDate ? new Date(startDate as string) : undefined,
        lte: endDate ? new Date(endDate as string) : undefined
      };
    }

    const messages = await prisma.whatsAppMessage.findMany({where});

    const analytics = {
      total: messages.length,
      inbound: messages.filter(m => m.direction === 'inbound').length,
      outbound: messages.filter(m => m.direction === 'outbound').length,
      uniqueCustomers: new Set(messages.map(m => m.customerId).filter(Boolean)).size,
      byType: {
        text: messages.filter(m => m.messageType === 'text').length,
        image: messages.filter(m => m.messageType === 'image').length,
        audio: messages.filter(m => m.messageType === 'audio').length,
        video: messages.filter(m => m.messageType === 'video').length,
        document: messages.filter(m => m.messageType === 'document').length
      },
      avgResponseTime: calculateAvgResponseTime(messages)
    };

    res.json({success: true, data: analytics});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ UTILITY FUNCTIONS ============

async function markMessageAsRead(messageId: string) {
  try {
    await axios.post(
      `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('Error marking as read:', error);
  }
}

async function downloadWhatsAppMedia(mediaId: string): Promise<string> {
  try {
    // Get media URL
    const mediaResponse = await axios.get(
      `${WHATSAPP_API_URL}/${mediaId}`,
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`
        }
      }
    );

    const mediaUrl = mediaResponse.data.url;

    // Download media
    const mediaData = await axios.get(mediaUrl, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`
      },
      responseType: 'arraybuffer'
    });

    // In production, upload to S3/storage
    // For now, return the temporary URL
    return mediaUrl;
  } catch (error) {
    console.error('Error downloading media:', error);
    return '';
  }
}

function calculateAvgResponseTime(messages: any[]): number {
  const sortedMessages = messages.sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  let totalResponseTime = 0;
  let responseCount = 0;

  for (let i = 1; i < sortedMessages.length; i++) {
    const prev = sortedMessages[i - 1];
    const curr = sortedMessages[i];

    if (prev.direction === 'inbound' && curr.direction === 'outbound') {
      const responseTime = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();
      totalResponseTime += responseTime;
      responseCount++;
    }
  }

  return responseCount > 0 ? totalResponseTime / responseCount / 1000 : 0; // Return in seconds
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'whatsapp-service',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`💚 WhatsApp Service running on port ${PORT}`);
});

export default app;
