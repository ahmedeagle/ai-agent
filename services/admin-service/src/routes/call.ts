import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Create a new call record
router.post('/', async (req, res) => {
  try {
    const { callSid, from, to, direction, status, agentId, companyId } = req.body;

    const call = await prisma.call.create({
      data: {
        callSid,
        from,
        to,
        direction: direction || 'inbound',
        status: status || 'initiated',
        agentId: agentId || null,
        companyId,
        startTime: new Date()
      }
    });

    res.json({ success: true, data: call });
  } catch (error: any) {
    // If duplicate callSid, just return success
    if (error?.code === 'P2002') {
      const existing = await prisma.call.findUnique({ where: { callSid: req.body.callSid } });
      return res.json({ success: true, data: existing });
    }
    console.error('Failed to create call:', error);
    res.status(500).json({ success: false, error: 'Failed to create call' });
  }
});

// Update call by callSid
router.put('/by-sid/:callSid', async (req, res) => {
  try {
    const { callSid } = req.params;
    const { status, duration, endTime, recordingUrl, escalated, escalationReason } = req.body;

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (duration !== undefined) updateData.duration = duration;
    if (endTime !== undefined) updateData.endTime = new Date(endTime);
    if (recordingUrl !== undefined) updateData.recordingUrl = recordingUrl;
    if (escalated !== undefined) updateData.escalated = escalated;
    if (escalationReason !== undefined) updateData.escalationReason = escalationReason;

    const call = await prisma.call.update({
      where: { callSid },
      data: updateData
    });

    res.json({ success: true, data: call });
  } catch (error) {
    console.error('Failed to update call:', error);
    res.status(500).json({ success: false, error: 'Failed to update call' });
  }
});

// Save transcript for a call
router.post('/by-sid/:callSid/transcript', async (req, res) => {
  try {
    const { callSid } = req.params;
    const { entries } = req.body;

    // Find the call by callSid
    const call = await prisma.call.findUnique({ where: { callSid } });
    if (!call) {
      return res.status(404).json({ success: false, error: 'Call not found' });
    }

    // Upsert transcript
    const transcript = await prisma.transcript.upsert({
      where: { callId: call.id },
      update: { entries },
      create: { callId: call.id, entries }
    });

    res.json({ success: true, data: transcript });
  } catch (error) {
    console.error('Failed to save transcript:', error);
    res.status(500).json({ success: false, error: 'Failed to save transcript' });
  }
});

// Get call logs
router.get('/', async (req, res) => {
  try {
    const { companyId, page = 1, limit = 50, search, direction, status, hasRecording, hasTranscript, startDate } = req.query;
    
    const where: any = { companyId: companyId as string };
    
    if (direction) where.direction = direction as string;
    if (status) where.status = status as string;
    if (hasRecording === 'true') where.recordingUrl = { not: null };
    if (hasTranscript === 'true') where.transcript = { isNot: null };
    if (startDate) where.createdAt = { gte: new Date(startDate as string) };
    if (search) {
      where.OR = [
        { from: { contains: search as string } },
        { to: { contains: search as string } },
        { callSid: { contains: search as string } }
      ];
    }

    const calls = await prisma.call.findMany({
      where,
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        agent: true,
        transcript: true,
        recording: true
      }
    });

    const total = await prisma.call.count({ where });

    res.json({
      success: true,
      data: {
        calls,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch calls' });
  }
});

// Get call details
router.get('/:id', async (req, res) => {
  try {
    const call = await prisma.call.findUnique({
      where: { id: req.params.id },
      include: {
        agent: true,
        transcript: true,
        recording: true
      }
    });

    res.json({ success: true, data: call });
  } catch (error) {
    res.status(404).json({ success: false, error: 'Call not found' });
  }
});

// Get call analytics
router.get('/analytics/summary', async (req, res) => {
  try {
    const { companyId, startDate, endDate } = req.query;

    // This would typically call the Analytics Service
    // For now, return basic stats from Prisma
    const totalCalls = await prisma.call.count({
      where: {
        companyId: companyId as string,
        createdAt: {
          gte: startDate ? new Date(startDate as string) : undefined,
          lte: endDate ? new Date(endDate as string) : undefined
        }
      }
    });

    const completedCalls = await prisma.call.count({
      where: {
        companyId: companyId as string,
        status: 'completed',
        createdAt: {
          gte: startDate ? new Date(startDate as string) : undefined,
          lte: endDate ? new Date(endDate as string) : undefined
        }
      }
    });

    res.json({
      success: true,
      data: {
        totalCalls,
        completedCalls,
        failedCalls: totalCalls - completedCalls,
        successRate: totalCalls > 0 ? (completedCalls / totalCalls) * 100 : 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
});

export default router;
