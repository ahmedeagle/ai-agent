import express from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.QUEUE_SERVICE_PORT || 3018;

app.use(express.json());

// Voice service URL
const VOICE_SERVICE_URL = process.env.VOICE_SERVICE_URL || 'http://localhost:3003';

// In-memory queue tracking
interface QueueEntry {
  callId: string;
  companyId: string;
  phone: string;
  priority: number;
  skills?: string[];
  joinedAt: Date;
  estimatedWaitTime: number;
}

const queues: Map<string, QueueEntry[]> = new Map(); // companyId -> queue entries

// ============ QUEUE MANAGEMENT ============

// Add call to queue
app.post('/queue/add', async (req, res) => {
  try {
    const {
      callId,
      companyId,
      phone,
      priority = 5,
      skills = [],
      metadata = {}
    } = req.body;

    // Create queue entry in DB
    const queueEntry = await prisma.queue.create({
      data: {
        callId,
        companyId,
        phone,
        priority,
        skills,
        metadata,
        status: 'waiting',
        position: 0 // Will be calculated
      }
    });

    // Add to in-memory queue
    const companyQueue = queues.get(companyId) || [];
    const entry: QueueEntry = {
      callId,
      companyId,
      phone,
      priority,
      skills,
      joinedAt: new Date(),
      estimatedWaitTime: calculateEstimatedWaitTime(companyQueue.length)
    };
    
    companyQueue.push(entry);
    
    // Sort by priority (higher priority first), then by join time
    companyQueue.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.joinedAt.getTime() - b.joinedAt.getTime();
    });
    
    queues.set(companyId, companyQueue);

    // Update positions in DB
    await updateQueuePositions(companyId);

    // Get caller's position
    const position = companyQueue.findIndex(e => e.callId === callId) + 1;

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
    res.status(500).json({success: false, error: error.message});
  }
});

// Get next call from queue (for agent assignment)
app.post('/queue/next', async (req, res) => {
  try {
    const {companyId, agentSkills = []} = req.body;

    const companyQueue = queues.get(companyId) || [];
    
    if (companyQueue.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'Queue is empty'
      });
    }

    // Find best matching call based on skills
    let selectedEntry: QueueEntry | null = null;
    let selectedIndex = -1;

    for (let i = 0; i < companyQueue.length; i++) {
      const entry = companyQueue[i];
      
      // Check if agent has required skills
      if (entry.skills && entry.skills.length > 0) {
        const hasRequiredSkills = entry.skills.every(skill => 
          agentSkills.includes(skill)
        );
        
        if (hasRequiredSkills) {
          selectedEntry = entry;
          selectedIndex = i;
          break;
        }
      } else {
        // No specific skills required, take this call
        selectedEntry = entry;
        selectedIndex = i;
        break;
      }
    }

    if (!selectedEntry) {
      return res.json({
        success: true,
        data: null,
        message: 'No matching calls for agent skills'
      });
    }

    // Remove from queue
    companyQueue.splice(selectedIndex, 1);
    queues.set(companyId, companyQueue);

    // Update DB
    await prisma.queue.update({
      where: {id: selectedEntry.callId},
      data: {
        status: 'connected',
        assignedAt: new Date(),
        waitTime: Math.floor((Date.now() - selectedEntry.joinedAt.getTime()) / 1000)
      }
    });

    // Update positions for remaining calls
    await updateQueuePositions(companyId);

    res.json({
      success: true,
      data: {
        callId: selectedEntry.callId,
        phone: selectedEntry.phone,
        waitTime: Math.floor((Date.now() - selectedEntry.joinedAt.getTime()) / 1000)
      }
    });
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Get caller's position in queue
app.get('/queue/position/:callId', async (req, res) => {
  try {
    const {callId} = req.params;

    const queueEntry = await prisma.queue.findFirst({
      where: {
        callId,
        status: 'waiting'
      }
    });

    if (!queueEntry) {
      return res.json({
        success: true,
        data: null,
        message: 'Call not in queue'
      });
    }

    const companyQueue = queues.get(queueEntry.companyId) || [];
    const position = companyQueue.findIndex(e => e.callId === callId) + 1;
    const estimatedWaitTime = calculateEstimatedWaitTime(position - 1);

    res.json({
      success: true,
      data: {
        position,
        queueSize: companyQueue.length,
        estimatedWaitTime
      }
    });
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Remove call from queue
app.post('/queue/remove', async (req, res) => {
  try {
    const {callId, reason = 'caller_hangup'} = req.body;

    const queueEntry = await prisma.queue.findFirst({
      where: {callId}
    });

    if (!queueEntry) {
      throw new Error('Queue entry not found');
    }

    // Remove from in-memory queue
    const companyQueue = queues.get(queueEntry.companyId) || [];
    const index = companyQueue.findIndex(e => e.callId === callId);
    
    if (index !== -1) {
      companyQueue.splice(index, 1);
      queues.set(queueEntry.companyId, companyQueue);
    }

    // Update DB
    await prisma.queue.update({
      where: {id: queueEntry.id},
      data: {
        status: reason === 'timeout' ? 'timeout' : 'abandoned',
        abandonedAt: new Date(),
        waitTime: Math.floor((Date.now() - queueEntry.createdAt.getTime()) / 1000)
      }
    });

    // Update positions
    await updateQueuePositions(queueEntry.companyId);

    res.json({success: true, message: 'Call removed from queue'});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Get queue status for company
app.get('/queue/:companyId/status', async (req, res) => {
  try {
    const {companyId} = req.params;

    const companyQueue = queues.get(companyId) || [];
    
    const waiting = await prisma.queue.count({
      where: {companyId, status: 'waiting'}
    });

    const avgWaitTime = await prisma.queue.aggregate({
      where: {
        companyId,
        status: {in: ['connected', 'abandoned']},
        waitTime: {not: null}
      },
      _avg: {
        waitTime: true
      }
    });

    const abandonRate = await calculateAbandonRate(companyId);

    res.json({
      success: true,
      data: {
        queueSize: companyQueue.length,
        waiting,
        averageWaitTime: Math.round(avgWaitTime._avg.waitTime || 0),
        abandonRate: Math.round(abandonRate * 100) / 100,
        entries: companyQueue.map((e, index) => ({
          callId: e.callId,
          phone: e.phone,
          position: index + 1,
          priority: e.priority,
          waitTime: Math.floor((Date.now() - e.joinedAt.getTime()) / 1000),
          estimatedWaitTime: e.estimatedWaitTime
        }))
      }
    });
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Get queue history
app.get('/queue/:companyId/history', async (req, res) => {
  try {
    const {companyId} = req.params;
    const {limit = 100, offset = 0, status} = req.query;

    const where: any = {companyId};
    if (status) {
      where.status = status;
    }

    const history = await prisma.queue.findMany({
      where,
      orderBy: {createdAt: 'desc'},
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    res.json({success: true, data: history});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ CALLBACK OFFERS ============

// Offer callback to caller
app.post('/queue/callback/offer', async (req, res) => {
  try {
    const {callId, estimatedCallbackTime} = req.body;

    const queueEntry = await prisma.queue.update({
      where: {id: callId},
      data: {
        callbackOffered: true,
        estimatedCallbackTime: estimatedCallbackTime ? new Date(estimatedCallbackTime) : null
      }
    });

    res.json({success: true, data: queueEntry});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Accept callback
app.post('/queue/callback/accept', async (req, res) => {
  try {
    const {callId} = req.body;

    const queueEntry = await prisma.queue.update({
      where: {id: callId},
      data: {
        callbackAccepted: true,
        status: 'callback_scheduled'
      }
    });

    // Remove from active queue
    const companyQueue = queues.get(queueEntry.companyId) || [];
    const index = companyQueue.findIndex(e => e.callId === callId);
    
    if (index !== -1) {
      companyQueue.splice(index, 1);
      queues.set(queueEntry.companyId, companyQueue);
    }

    res.json({success: true, data: queueEntry});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Get pending callbacks
app.get('/queue/:companyId/callbacks', async (req, res) => {
  try {
    const {companyId} = req.params;

    const callbacks = await prisma.queue.findMany({
      where: {
        companyId,
        status: 'callback_scheduled',
        callbackAccepted: true
      },
      orderBy: {createdAt: 'asc'}
    });

    res.json({success: true, data: callbacks});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ STATISTICS ============

app.get('/queue/:companyId/stats', async (req, res) => {
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

    const total = await prisma.queue.count({where});
    const connected = await prisma.queue.count({where: {...where, status: 'connected'}});
    const abandoned = await prisma.queue.count({where: {...where, status: 'abandoned'}});
    const timeout = await prisma.queue.count({where: {...where, status: 'timeout'}});
    
    const avgWaitTime = await prisma.queue.aggregate({
      where: {
        ...where,
        waitTime: {not: null}
      },
      _avg: {
        waitTime: true
      }
    });

    const abandonRate = abandoned / (total || 1);

    res.json({
      success: true,
      data: {
        total,
        connected,
        abandoned,
        timeout,
        averageWaitTime: Math.round(avgWaitTime._avg.waitTime || 0),
        abandonRate: Math.round(abandonRate * 100 * 100) / 100 // percentage with 2 decimals
      }
    });
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
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
    await prisma.queue.updateMany({
      where: {callId: companyQueue[i].callId},
      data: {position: i + 1}
    });
  }
}

async function calculateAbandonRate(companyId: string): Promise<number> {
  const total = await prisma.queue.count({where: {companyId}});
  const abandoned = await prisma.queue.count({
    where: {
      companyId,
      status: {in: ['abandoned', 'timeout']}
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

app.listen(PORT, () => {
  console.log(`📋 Queue Service running on port ${PORT}`);
});

export default app;
