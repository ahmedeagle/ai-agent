import express from 'express';
import { PrismaClient } from '@prisma/client';
import { io, Socket } from 'socket.io-client';
import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.TRANSFER_SERVICE_PORT || 3009;

app.use(express.json());

// Lazy Twilio init - only create client when credentials exist
function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token || !sid.startsWith('AC')) {
    console.warn('Twilio credentials not configured - transfer features disabled');
    return null;
  }
  return twilio(sid, token);
}
const twilioClient = getTwilioClient();

// ============ AGENT STATUS MANAGEMENT ============

// Get available agents for transfer
app.get('/agents/available', async (req, res) => {
  try {
    const {companyId, skills, language} = req.query;

    let where: any = {
      companyId: companyId as string,
      active: true,
      status: {
        status: 'available'
      }
    };

    if (skills) {
      where.skills = {
        hasSome: (skills as string).split(',')
      };
    }

    if (language) {
      where.languages = {
        has: language as string
      };
    }

    const agents = await prisma.humanAgent.findMany({
      where,
      include: {
        status: true
      },
      orderBy: {
        status: {
          currentCalls: 'asc' // Least busy first
        }
      }
    });

    // Filter by max concurrent calls
    const available = agents.filter(
      agent => agent.status && agent.status.currentCalls < agent.maxConcurrent
    );

    res.json({
      success: true,
      data: available
    });
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Update agent status
app.put('/agents/:agentId/status', async (req, res) => {
  try {
    const {agentId} = req.params;
    const {status, statusReason} = req.body;

    const agentStatus = await prisma.agentStatus.upsert({
      where: {agentId},
      update: {
        status,
        statusReason,
        lastStatusChange: new Date()
      },
      create: {
        agentId,
        status,
        statusReason,
        currentCalls: 0
      }
    });

    res.json({success: true, data: agentStatus});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ CALL TRANSFER OPERATIONS ============

// Initiate transfer
app.post('/transfer/initiate', async (req, res) => {
  try {
    const {
      callId,
      callSid,
      fromType,
      fromAgentId,
      toType,
      toAgentId,
      transferType,
      reason,
      briefing
    } = req.body;

    // Find target agent if human transfer
    let targetAgent = null;
    if (toType === 'human' && toAgentId) {
      targetAgent = await prisma.humanAgent.findUnique({
        where: {id: toAgentId},
        include: {status: true}
      });

      if (!targetAgent) {
        return res.status(404).json({
          success: false,
          error: 'Target agent not found'
        });
      }

      if (targetAgent.status?.status !== 'available') {
        return res.status(400).json({
          success: false,
          error: 'Target agent is not available'
        });
      }
    }

    // Create transfer record
    const transfer = await prisma.callTransfer.create({
      data: {
        callId,
        fromType,
        fromAgentId,
        toType,
        toAgentId,
        transferType,
        reason,
        briefing,
        status: 'pending'
      }
    });

    // Update call status
    await prisma.call.update({
      where: {id: callId},
      data: {
        escalated: true,
        escalationReason: reason
      }
    });

    // If warm transfer, connect to target agent first
    if (transferType === 'warm' && targetAgent && targetAgent.phoneNumber) {
      // Dial the target agent
      const call = await twilioClient.calls.create({
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: targetAgent.phoneNumber,
        url: `${process.env.API_URL}/transfer/connect/${transfer.id}`,
        statusCallback: `${process.env.API_URL}/transfer/status/${transfer.id}`,
        statusCallbackEvent: ['initiated', 'answered', 'completed']
      });

      await prisma.callTransfer.update({
        where: {id: transfer.id},
        data: {status: 'connecting'}
      });

      // TODO: Play briefing to agent before bridging
    } else if (transferType === 'cold' && targetAgent && targetAgent.phoneNumber) {
      // Direct transfer without briefing
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.dial({
        action: `${process.env.API_URL}/transfer/complete/${transfer.id}`,
        callerId: process.env.TWILIO_PHONE_NUMBER
      }).number(targetAgent.phoneNumber);

      await twilioClient.calls(callSid).update({
        twiml: twiml.toString()
      });

      await prisma.callTransfer.update({
        where: {id: transfer.id},
        data: {status: 'in_progress'}
      });
    } else if (toType === 'voicemail') {
      // Transfer to voicemail
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say('Please leave a message after the beep.');
      twiml.record({
        maxLength: 300,
        action: `${process.env.API_URL}/voicemail/save`,
        transcribe: true,
        transcribeCallback: `${process.env.API_URL}/voicemail/transcribe`
      });

      await twilioClient.calls(callSid).update({
        twiml: twiml.toString()
      });

      await prisma.callTransfer.update({
        where: {id: transfer.id},
        data: {status: 'completed', completedAt: new Date()}
      });
    }

    // Increment agent's current call count
    if (toAgentId) {
      await prisma.agentStatus.update({
        where: {agentId: toAgentId},
        data: {
          currentCalls: {increment: 1}
        }
      });
    }

    // Send notification to supervisor
    await prisma.notification.create({
      data: {
        type: 'escalation',
        severity: 'warning',
        title: 'Call Escalated',
        message: `Call ${callSid} has been escalated: ${reason}`,
        callId,
        agentId: toAgentId,
        companyId: targetAgent?.companyId || '',
        actionUrl: `/calls/${callId}`
      }
    });

    res.json({
      success: true,
      data: transfer
    });
  } catch (error: any) {
    console.error('Transfer initiation error:', error);
    res.status(500).json({success: false, error: error.message});
  }
});

// Accept transfer (for warm transfers)
app.post('/transfer/:id/accept', async (req, res) => {
  try {
    const {id} = req.params;

    const transfer = await prisma.callTransfer.update({
      where: {id},
      data: {
        status: 'accepted',
        acceptedAt: new Date()
      }
    });

    res.json({success: true, data: transfer});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Reject transfer
app.post('/transfer/:id/reject', async (req, res) => {
  try {
    const {id} = req.params;
    const {reason} = req.body;

    const transfer = await prisma.callTransfer.update({
      where: {id},
      data: {
        status: 'rejected',
        reason: reason || transfer.reason
      }
    });

    // Decrement agent's current call count
    if (transfer.toAgentId) {
      await prisma.agentStatus.update({
        where: {agentId: transfer.toAgentId},
        data: {
          currentCalls: {decrement: 1}
        }
      });
    }

    res.json({success: true, data: transfer});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Complete transfer
app.post('/transfer/:id/complete', async (req, res) => {
  try {
    const {id} = req.params;

    const transfer = await prisma.callTransfer.update({
      where: {id},
      data: {
        status: 'completed',
        completedAt: new Date()
      }
    });

    // Decrement agent's current call count
    if (transfer.toAgentId) {
      await prisma.agentStatus.update({
        where: {agentId: transfer.toAgentId},
        data: {
          currentCalls: {decrement: 1}
        }
      });
    }

    res.json({success: true, data: transfer});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Get transfer history for call
app.get('/transfer/call/:callId', async (req, res) => {
  try {
    const {callId} = req.params;

    const transfers = await prisma.callTransfer.findMany({
      where: {callId},
      include: {
        toAgent: true
      },
      orderBy: {createdAt: 'asc'}
    });

    res.json({success: true, data: transfers});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ AUTO-ESCALATION LOGIC ============

// Evaluate if call should be escalated
app.post('/transfer/evaluate-escalation', async (req, res) => {
  try {
    const {callId, sentiment, qaScore, duration, intent} = req.body;

    let shouldEscalate = false;
    let reason = '';

    // Rule 1: Negative sentiment for extended period
    if (sentiment && sentiment.negative > 0.7) {
      shouldEscalate = true;
      reason = 'Negative customer sentiment detected';
    }

    // Rule 2: Low QA score during call
    if (qaScore && qaScore < 50) {
      shouldEscalate = true;
      reason = 'Low quality score detected';
    }

    // Rule 3: Extended call duration (potential complexity)
    if (duration && duration > 600) { // 10 minutes
      shouldEscalate = true;
      reason = 'Extended call duration - complex issue';
    }

    // Rule 4: Specific intents that require human
    const humanRequiredIntents = ['refund', 'complaint', 'legal', 'urgent'];
    if (intent && humanRequiredIntents.includes(intent.toLowerCase())) {
      shouldEscalate = true;
      reason = `Human assistance required for intent: ${intent}`;
    }

    res.json({
      success: true,
      data: {
        shouldEscalate,
        reason,
        confidence: shouldEscalate ? 0.85 : 0.15
      }
    });
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'transfer-service',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🔄 Transfer Service running on port ${PORT}`);
});

export default app;
