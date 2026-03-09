import express from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.CAMPAIGNS_SERVICE_PORT || 3016;

app.use(express.json());

// Voice service URL
const VOICE_SERVICE_URL = process.env.VOICE_SERVICE_URL || 'http://voice-service:3001';

// ============ CAMPAIGN MANAGEMENT ============

// Create campaign
app.post('/campaigns', async (req, res) => {
  try {
    const {
      companyId,
      name,
      agentId,
      type,
      contactList,
      schedule,
      maxRetries,
      retryDelay,
      script,
      callObjective,
    } = req.body;

    if (!Array.isArray(contactList) || contactList.length === 0) {
      throw new Error('Contact list must be a non-empty array');
    }

    const campaign = await prisma.campaign.create({
      data: {
        companyId,
        name,
        agentId,
        type: type || 'outbound',
        contactList,
        totalContacts: contactList.length,
        schedule: schedule || null,
        maxRetries: maxRetries || 3,
        retryDelay: retryDelay || 3600,
        script,
        callObjective,
        status: 'draft'
      }
    });

    res.json({success: true, data: campaign});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Get campaigns
app.get('/campaigns/:companyId', async (req, res) => {
  try {
    const {companyId} = req.params;

    const campaigns = await prisma.campaign.findMany({
      where: {companyId},
      orderBy: {createdAt: 'desc'},
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            voice: true
          }
        }
      }
    });

    res.json({success: true, data: campaigns});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Get campaign by ID
app.get('/campaigns/:companyId/:campaignId', async (req, res) => {
  try {
    const {campaignId} = req.params;

    const campaign = await prisma.campaign.findUnique({
      where: {id: campaignId},
      include: {
        agent: {
          select: { id: true, name: true, voice: true }
        },
        campaignCalls: {
          orderBy: {createdAt: 'desc'},
          take: 100
        }
      }
    });

    res.json({success: true, data: campaign});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Start campaign
app.post('/campaigns/:campaignId/start', async (req, res) => {
  try {
    const {campaignId} = req.params;

    const campaign = await prisma.campaign.findUnique({
      where: {id: campaignId}
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status === 'running') {
      throw new Error('Campaign is already running');
    }

    // Update status
    await prisma.campaign.update({
      where: {id: campaignId},
      data: {status: 'running'}
    });

    // Create campaign calls for all contacts
    const contactList = campaign.contactList as any[];
    const calls = contactList.map(contact => ({
      campaignId,
      contactName: contact.name || 'Unknown',
      phone: contact.phone || contact,
      contactData: contact.data || null,
      status: 'pending',
      attempts: 0
    }));

    await prisma.campaignCall.createMany({
      data: calls
    });

    // Start calling process (non-blocking)
    processCampaignCalls(campaignId);

    res.json({
      success: true,
      message: 'Campaign started',
      totalContacts: contactList.length
    });
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Pause campaign
app.post('/campaigns/:campaignId/pause', async (req, res) => {
  try {
    const {campaignId} = req.params;

    const campaign = await prisma.campaign.update({
      where: {id: campaignId},
      data: {status: 'paused'}
    });

    res.json({success: true, data: campaign});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Resume campaign
app.post('/campaigns/:campaignId/resume', async (req, res) => {
  try {
    const {campaignId} = req.params;

    await prisma.campaign.update({
      where: {id: campaignId},
      data: {status: 'running'}
    });

    // Resume calling process
    processCampaignCalls(campaignId);

    res.json({success: true, message: 'Campaign resumed'});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Stop campaign
app.post('/campaigns/:campaignId/stop', async (req, res) => {
  try {
    const {campaignId} = req.params;

    const campaign = await prisma.campaign.update({
      where: {id: campaignId},
      data: {status: 'completed'}
    });

    res.json({success: true, data: campaign});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Get campaign statistics
app.get('/campaigns/:campaignId/stats', async (req, res) => {
  try {
    const {campaignId} = req.params;

    const campaign = await prisma.campaign.findUnique({
      where: {id: campaignId}
    });

    const calls = await prisma.campaignCall.findMany({
      where: {campaignId}
    });

    const stats = {
      totalContacts: campaign?.totalContacts || 0,
      contactsReached: campaign?.contactsReached || 0,
      successfulCalls: campaign?.successfulCalls || 0,
      failedCalls: campaign?.failedCalls || 0,
      pendingCalls: calls.filter(c => c.status === 'pending').length,
      callingCalls: calls.filter(c => c.status === 'calling').length,
      completedCalls: calls.filter(c => c.status === 'completed').length,
      noAnswerCalls: calls.filter(c => c.status === 'no_answer').length,
      busyCalls: calls.filter(c => c.status === 'busy').length,
      totalDuration: calls.reduce((sum, c) => sum + (c.callDuration || 0), 0),
      averageDuration: calls.length > 0 ? calls.reduce((sum, c) => sum + (c.callDuration || 0), 0) / calls.length : 0
    };

    res.json({success: true, data: stats});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ CAMPAIGN CALLS ============

// Get campaign calls
app.get('/campaigns/:campaignId/calls', async (req, res) => {
  try {
    const {campaignId} = req.params;
    const {status, limit = 100, offset = 0} = req.query;

    const where: any = {campaignId};
    if (status) {
      where.status = status;
    }

    const calls = await prisma.campaignCall.findMany({
      where,
      orderBy: {createdAt: 'desc'},
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    res.json({success: true, data: calls});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Update campaign call
app.patch('/campaigns/calls/:callId', async (req, res) => {
  try {
    const {callId} = req.params;
    const {status, callDuration, callOutcome, notes} = req.body;

    const call = await prisma.campaignCall.update({
      where: {id: callId},
      data: {
        status,
        callDuration,
        callOutcome,
        callNotes: notes,
        lastAttempt: new Date()
      }
    });

    // Update campaign counters
    if (status === 'completed') {
      await prisma.campaign.update({
        where: {id: call.campaignId},
        data: {
          contactsReached: {increment: 1},
          successfulCalls: {increment: 1}
        }
      });
    } else if (status === 'failed') {
      await prisma.campaign.update({
        where: {id: call.campaignId},
        data: {
          failedCalls: {increment: 1}
        }
      });
    }

    res.json({success: true, data: call});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ CALLING ENGINE ============

async function processCampaignCalls(campaignId: string) {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: {id: campaignId}
    });

    if (!campaign || campaign.status !== 'running') {
      return;
    }

    // Check time window from schedule
    const schedule = campaign.schedule as any;
    if (schedule?.startTime && schedule?.endTime) {
      const now = new Date();
      const [startH, startM] = schedule.startTime.split(':').map(Number);
      const [endH, endM] = schedule.endTime.split(':').map(Number);
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
        console.log(`Campaign ${campaignId} outside scheduled hours`);
        return;
      }
      // check day of week
      if (schedule.days && !schedule.days.includes(now.getDay())) {
        console.log(`Campaign ${campaignId} not scheduled for today`);
        return;
      }
    }
    if (campaign.endDate && now > campaign.endDate) {
      await prisma.campaign.update({
        where: {id: campaignId},
        data: {status: 'completed'}
      });
      console.log(`Campaign ${campaignId} ended`);
      return;
    }

    // Get next pending call
    const pendingCall = await prisma.campaignCall.findFirst({
      where: {
        campaignId,
        status: 'pending',
        attempts: {lt: campaign.maxRetries}
      },
      orderBy: {createdAt: 'asc'}
    });

    if (!pendingCall) {
      // No more calls, mark campaign as completed
      await prisma.campaign.update({
        where: {id: campaignId},
        data: {status: 'completed'}
      });
      console.log(`Campaign ${campaignId} completed - no more pending calls`);
      return;
    }

    // Make the call
    await makeOutboundCall(campaign, pendingCall);

    // Schedule next call (delay between calls)
    setTimeout(() => {
      processCampaignCalls(campaignId);
    }, 5000); // 5 seconds between calls

  } catch (error) {
    console.error('Error processing campaign calls:', error);
  }
}

async function makeOutboundCall(campaign: any, call: any) {
  try {
    // Update call status
    await prisma.campaignCall.update({
      where: {id: call.id},
      data: {
        status: 'calling',
        attempts: {increment: 1},
        lastAttempt: new Date()
      }
    });

    console.log(`📞 Calling ${call.phone} for campaign ${campaign.name}`);

    // Initiate call via voice service (Twilio)
    try {
      const response = await axios.post(`${VOICE_SERVICE_URL}/calls/initiate`, {
        to: call.phone,
        companyId: campaign.companyId,
        agentId: campaign.agentId,
        campaignId: campaign.id,
        campaignCallId: call.id,
        customScript: campaign.script
      });

      if (response.data.success) {
        console.log(`✅ Call initiated successfully for ${call.phone}`);
      }
    } catch (callError: any) {
      console.error(`❌ Failed to initiate call for ${call.phone}:`, callError.message);
      
      // Update call as failed
      await prisma.campaignCall.update({
        where: {id: call.id},
        data: {
          status: call.attempts >= campaign.maxRetries ? 'failed' : 'pending',
          notes: `Call initiation failed: ${callError.message}`
        }
      });

      await prisma.campaign.update({
        where: {id: campaign.id},
        data: {
          failedCalls: {increment: 1}
        }
      });
    }

  } catch (error) {
    console.error('Error making outbound call:', error);
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'campaigns-service',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`📢 Campaigns Service running on port ${PORT}`);
});

export default app;
