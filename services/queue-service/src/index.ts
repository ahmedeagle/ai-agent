import express from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.QUEUE_SERVICE_PORT || 3018;

app.use(express.json());

// Voice service URL - use Docker service name
const VOICE_SERVICE_URL = process.env.VOICE_SERVICE_URL || 'http://voice-service:3001';

// In-memory queue tracking (backed by DB for persistence)
interface MemQueueEntry {
  callSid: string;
  companyId: string;
  queueId: string;
  priority: number;
  requiredSkills: string[];
  joinedAt: Date;
  estimatedWaitTime: number;
}

const queues: Map<string, MemQueueEntry[]> = new Map(); // companyId -> queue entries

// Cache of default queues per company
const defaultQueueIds: Map<string, string> = new Map();

// Get or create default queue for a company
async function getOrCreateDefaultQueue(companyId: string): Promise<string> {
  const cached = defaultQueueIds.get(companyId);
  if (cached) return cached;

  let queue = await prisma.callQueue.findFirst({
    where: { companyId, active: true },
    orderBy: { createdAt: 'asc' }
  });

  if (!queue) {
    queue = await prisma.callQueue.create({
      data: {
        name: 'Default Queue',
        companyId,
        maxSize: 100,
        strategy: 'priority',
        timeoutSeconds: 300,
        active: true
      }
    });
  }

  defaultQueueIds.set(companyId, queue.id);
  return queue.id;
}

// Recover in-memory queues from DB on startup
async function recoverQueuesFromDB() {
  try {
    const waitingEntries = await prisma.queueEntry.findMany({
      where: { status: 'waiting' },
      include: { queue: true },
      orderBy: [{ priority: 'desc' }, { enteredAt: 'asc' }]
    });

    for (const entry of waitingEntries) {
      const companyId = entry.queue.companyId;
      const companyQueue = queues.get(companyId) || [];
      companyQueue.push({
        callSid: entry.callSid,
        companyId,
        queueId: entry.queueId,
        priority: entry.priority,
        requiredSkills: entry.requiredSkills || [],
        joinedAt: entry.enteredAt,
        estimatedWaitTime: entry.estimatedWait || 0
      });
      queues.set(companyId, companyQueue);
    }

    console.log(`Recovered ${waitingEntries.length} queue entries from DB`);
  } catch (error) {
    console.error('Failed to recover queues from DB:', error);
  }
}

// ============ QUEUE MANAGEMENT ============

// Create a new call queue
app.post('/queue/create', async (req, res) => {
  try {
    const { name, companyId, maxSize = 100, strategy = 'priority', holdMusic, announcements, timeoutSeconds = 300 } = req.body;

    const queue = await prisma.callQueue.create({
      data: { name, companyId, maxSize, strategy, holdMusic, announcements, timeoutSeconds, active: true }
    });

    res.json({ success: true, data: queue });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// List queues for a company
app.get('/queue/list/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const queueList = await prisma.callQueue.findMany({
      where: { companyId },
      include: { entries: { where: { status: 'waiting' } } },
      orderBy: { createdAt: 'asc' }
    });

    res.json({
      success: true,
      data: queueList.map(q => ({
        ...q,
        waitingCount: q.entries.length,
        entries: undefined
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add call to queue
app.post('/queue/add', async (req, res) => {
  try {
    const {
      callSid,
      callId, // backward compat alias
      companyId,
      queueId,
      priority = 5,
      requiredSkills = [],
      skills = [], // backward compat alias
      customerId
    } = req.body;

    const sid = callSid || callId;
    if (!sid || !companyId) {
      return res.status(400).json({ success: false, error: 'callSid and companyId are required' });
    }

    const resolvedQueueId = queueId || await getOrCreateDefaultQueue(companyId);
    const resolvedSkills = requiredSkills.length > 0 ? requiredSkills : skills;

    // Create queue entry in DB
    const queueEntry = await prisma.queueEntry.create({
      data: {
        queueId: resolvedQueueId,
        callSid: sid,
        priority,
        requiredSkills: resolvedSkills,
        status: 'waiting',
        position: 0,
        customerId: customerId || null,
        estimatedWait: 0
      }
    });

    // Add to in-memory queue
    const companyQueue = queues.get(companyId) || [];
    const entry: MemQueueEntry = {
      callSid: sid,
      companyId,
      queueId: resolvedQueueId,
      priority,
      requiredSkills: resolvedSkills,
      joinedAt: new Date(),
      estimatedWaitTime: calculateEstimatedWaitTime(companyQueue.length)
    };

    companyQueue.push(entry);

    // Sort by priority (higher priority first), then by join time
    companyQueue.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.joinedAt.getTime() - b.joinedAt.getTime();
    });

    queues.set(companyId, companyQueue);

    // Update positions in DB
    await updateQueuePositions(companyId);

    const position = companyQueue.findIndex(e => e.callSid === sid) + 1;

    res.json({
      success: true,
      data: {
        queueEntry,
        position,
        queueSize: companyQueue.length,
        estimatedWaitTime: entry.estimatedWaitTime
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get next call from queue (for agent assignment)
app.post('/queue/next', async (req, res) => {
  try {
    const { companyId, agentSkills = [] } = req.body;

    const companyQueue = queues.get(companyId) || [];

    if (companyQueue.length === 0) {
      return res.json({ success: true, data: null, message: 'Queue is empty' });
    }

    // Find best matching call based on skills
    let selectedEntry: MemQueueEntry | null = null;
    let selectedIndex = -1;

    for (let i = 0; i < companyQueue.length; i++) {
      const entry = companyQueue[i];

      if (entry.requiredSkills && entry.requiredSkills.length > 0) {
        const hasRequiredSkills = entry.requiredSkills.every(skill =>
          agentSkills.includes(skill)
        );
        if (hasRequiredSkills) {
          selectedEntry = entry;
          selectedIndex = i;
          break;
        }
      } else {
        selectedEntry = entry;
        selectedIndex = i;
        break;
      }
    }

    if (!selectedEntry) {
      return res.json({ success: true, data: null, message: 'No matching calls for agent skills' });
    }

    // Remove from queue
    companyQueue.splice(selectedIndex, 1);
    queues.set(companyId, companyQueue);

    const waitTimeSec = Math.floor((Date.now() - selectedEntry.joinedAt.getTime()) / 1000);

    // Update DB
    await prisma.queueEntry.update({
      where: { callSid: selectedEntry.callSid },
      data: {
        status: 'in_progress',
        assignedAt: new Date(),
        estimatedWait: waitTimeSec
      }
    });

    await updateQueuePositions(companyId);

    res.json({
      success: true,
      data: {
        callSid: selectedEntry.callSid,
        callId: selectedEntry.callSid, // backward compat
        waitTime: waitTimeSec
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get caller's position in queue
app.get('/queue/position/:callSid', async (req, res) => {
  try {
    const { callSid } = req.params;

    const queueEntry = await prisma.queueEntry.findUnique({
      where: { callSid },
      include: { queue: true }
    });

    if (!queueEntry || queueEntry.status !== 'waiting') {
      return res.json({ success: true, data: null, message: 'Call not in queue' });
    }

    const companyId = queueEntry.queue.companyId;
    const companyQueue = queues.get(companyId) || [];
    const position = companyQueue.findIndex(e => e.callSid === callSid) + 1;
    const estimatedWaitTime = calculateEstimatedWaitTime(position - 1);

    res.json({
      success: true,
      data: { position, queueSize: companyQueue.length, estimatedWaitTime }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Remove call from queue
app.post('/queue/remove', async (req, res) => {
  try {
    const { callSid, callId, reason = 'caller_hangup' } = req.body;
    const sid = callSid || callId;

    const queueEntry = await prisma.queueEntry.findUnique({
      where: { callSid: sid },
      include: { queue: true }
    });

    if (!queueEntry) {
      throw new Error('Queue entry not found');
    }

    const companyId = queueEntry.queue.companyId;

    // Remove from in-memory queue
    const companyQueue = queues.get(companyId) || [];
    const index = companyQueue.findIndex(e => e.callSid === sid);

    if (index !== -1) {
      companyQueue.splice(index, 1);
      queues.set(companyId, companyQueue);
    }

    // Update DB
    await prisma.queueEntry.update({
      where: { callSid: sid },
      data: {
        status: reason === 'timeout' ? 'timeout' : 'abandoned',
        abandonedAt: new Date()
      }
    });

    await updateQueuePositions(companyId);

    res.json({ success: true, message: 'Call removed from queue' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get queue status for company
app.get('/queue/:companyId/status', async (req, res) => {
  try {
    const { companyId } = req.params;

    const companyQueue = queues.get(companyId) || [];

    // Count waiting entries from DB for accuracy
    const queueIds = await prisma.callQueue.findMany({
      where: { companyId, active: true },
      select: { id: true }
    });
    const qids = queueIds.map(q => q.id);

    const waiting = await prisma.queueEntry.count({
      where: { queueId: { in: qids }, status: 'waiting' }
    });

    // Calculate average wait from completed/abandoned entries
    const completedEntries = await prisma.queueEntry.findMany({
      where: {
        queueId: { in: qids },
        status: { in: ['completed', 'in_progress', 'abandoned'] },
        assignedAt: { not: null }
      },
      select: { enteredAt: true, assignedAt: true, completedAt: true, abandonedAt: true }
    });

    let totalWait = 0;
    let waitCount = 0;
    for (const e of completedEntries) {
      const endTime = e.assignedAt || e.completedAt || e.abandonedAt;
      if (endTime) {
        totalWait += (endTime.getTime() - e.enteredAt.getTime()) / 1000;
        waitCount++;
      }
    }
    const avgWaitTime = waitCount > 0 ? Math.round(totalWait / waitCount) : 0;

    const abandonRate = await calculateAbandonRate(companyId);

    res.json({
      success: true,
      data: {
        queueSize: companyQueue.length,
        waiting,
        averageWaitTime: avgWaitTime,
        abandonRate: Math.round(abandonRate * 100) / 100,
        entries: companyQueue.map((e, index) => ({
          callSid: e.callSid,
          callId: e.callSid,
          position: index + 1,
          priority: e.priority,
          waitTime: Math.floor((Date.now() - e.joinedAt.getTime()) / 1000),
          estimatedWaitTime: e.estimatedWaitTime
        }))
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get queue history
app.get('/queue/:companyId/history', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { limit = '100', offset = '0', status } = req.query;

    const queueIds = await prisma.callQueue.findMany({
      where: { companyId },
      select: { id: true }
    });
    const qids = queueIds.map(q => q.id);

    const where: any = { queueId: { in: qids } };
    if (status) where.status = status as string;

    const history = await prisma.queueEntry.findMany({
      where,
      orderBy: { enteredAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    res.json({ success: true, data: history });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ CALLBACK OFFERS (simplified - status-based) ============

app.post('/queue/callback/offer', async (req, res) => {
  try {
    const { callSid, callId } = req.body;
    const sid = callSid || callId;

    // Mark as completed (callback offered = caller leaves queue)
    const entry = await prisma.queueEntry.update({
      where: { callSid: sid },
      data: { status: 'completed', completedAt: new Date() }
    });

    res.json({ success: true, data: entry });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/queue/:companyId/callbacks', async (req, res) => {
  try {
    const { companyId } = req.params;

    const queueIds = await prisma.callQueue.findMany({
      where: { companyId },
      select: { id: true }
    });

    const callbacks = await prisma.queueEntry.findMany({
      where: {
        queueId: { in: queueIds.map(q => q.id) },
        status: 'completed'
      },
      orderBy: { enteredAt: 'asc' }
    });

    res.json({ success: true, data: callbacks });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ STATISTICS ============

app.get('/queue/:companyId/stats', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { startDate, endDate } = req.query;

    const queueIds = await prisma.callQueue.findMany({
      where: { companyId },
      select: { id: true }
    });
    const qids = queueIds.map(q => q.id);

    const where: any = { queueId: { in: qids } };
    if (startDate || endDate) {
      where.enteredAt = {};
      if (startDate) where.enteredAt.gte = new Date(startDate as string);
      if (endDate) where.enteredAt.lte = new Date(endDate as string);
    }

    const total = await prisma.queueEntry.count({ where });
    const completed = await prisma.queueEntry.count({ where: { ...where, status: 'completed' } });
    const inProgress = await prisma.queueEntry.count({ where: { ...where, status: 'in_progress' } });
    const abandoned = await prisma.queueEntry.count({ where: { ...where, status: 'abandoned' } });
    const timeout = await prisma.queueEntry.count({ where: { ...where, status: 'timeout' } });

    // Calculate average wait time from entries that have assignedAt
    const entriesWithWait = await prisma.queueEntry.findMany({
      where: { ...where, assignedAt: { not: null } },
      select: { enteredAt: true, assignedAt: true }
    });

    let totalWaitSec = 0;
    for (const e of entriesWithWait) {
      if (e.assignedAt) {
        totalWaitSec += (e.assignedAt.getTime() - e.enteredAt.getTime()) / 1000;
      }
    }
    const avgWait = entriesWithWait.length > 0 ? Math.round(totalWaitSec / entriesWithWait.length) : 0;

    const abandonRate = total > 0 ? Math.round((abandoned / total) * 10000) / 100 : 0;

    res.json({
      success: true,
      data: {
        total,
        completed,
        inProgress,
        abandoned,
        timeout,
        averageWaitTime: avgWait,
        abandonRate
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ HELPER FUNCTIONS ============

function calculateEstimatedWaitTime(queuePosition: number): number {
  const avgCallDuration = 180; // 3 minutes average
  return queuePosition * avgCallDuration;
}

async function updateQueuePositions(companyId: string) {
  const companyQueue = queues.get(companyId) || [];

  for (let i = 0; i < companyQueue.length; i++) {
    try {
      await prisma.queueEntry.update({
        where: { callSid: companyQueue[i].callSid },
        data: { position: i + 1, estimatedWait: calculateEstimatedWaitTime(i) }
      });
    } catch (e) {
      // Entry might have been removed concurrently
    }
  }
}

async function calculateAbandonRate(companyId: string): Promise<number> {
  const queueIds = await prisma.callQueue.findMany({
    where: { companyId },
    select: { id: true }
  });
  const qids = queueIds.map(q => q.id);

  const total = await prisma.queueEntry.count({ where: { queueId: { in: qids } } });
  const abandoned = await prisma.queueEntry.count({
    where: {
      queueId: { in: qids },
      status: { in: ['abandoned', 'timeout'] }
    }
  });

  return total > 0 ? abandoned / total : 0;
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'queue-service',
    timestamp: new Date().toISOString(),
    activeQueues: queues.size
  });
});

// Start server and recover state
async function start() {
  await recoverQueuesFromDB();
  app.listen(PORT, () => {
    console.log(`📋 Queue Service running on port ${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start queue service:', err);
  process.exit(1);
});

export default app;
