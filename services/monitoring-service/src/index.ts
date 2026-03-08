import express from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.MONITORING_SERVICE_PORT || 3019;

app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const VOICE_SERVICE_URL = process.env.VOICE_SERVICE_URL || 'http://localhost:3003';

// Active monitoring sessions
interface MonitoringSession {
  id: string;
  supervisorId: string;
  callId: string;
  mode: 'listen' | 'whisper' | 'barge';
  startedAt: Date;
  conferenceId?: string;
}

const activeSessions = new Map<string, MonitoringSession>();

// ============ AUTHENTICATION MIDDLEWARE ============

async function authenticateSupervisor(req: any, res: any, next: any) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({success: false, error: 'No token provided'});
    }

    const decoded: any = jwt.verify(token, JWT_SECRET);
    
    // Get user and check if supervisor
    const user = await prisma.user.findUnique({
      where: {id: decoded.userId}
    });

    if (!user) {
      return res.status(401).json({success: false, error: 'User not found'});
    }

    if (user.role !== 'admin' && user.role !== 'supervisor') {
      return res.status(403).json({success: false, error: 'Insufficient permissions'});
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({success: false, error: 'Invalid token'});
  }
}

// ============ ACTIVE CALLS MONITORING ============

// Get active calls for monitoring
app.get('/monitor/calls/active/:companyId', authenticateSupervisor, async (req: any, res) => {
  try {
    const {companyId} = req.params;

    // Verify supervisor belongs to company
    if (req.user.companyId !== companyId) {
      return res.status(403).json({success: false, error: 'Access denied'});
    }

    const activeCalls = await prisma.call.findMany({
      where: {
        companyId,
        status: {in: ['in-progress', 'talking']}
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            voice: true
          }
        }
      },
      orderBy: {startTime: 'desc'}
    });

    // Enrich with monitoring info
    const enrichedCalls = activeCalls.map(call => {
      const session = activeSessions.get(call.id);
      return {
        ...call,
        isBeingMonitored: !!session,
        monitorMode: session?.mode,
        monitoredBy: session?.supervisorId
      };
    });

    res.json({success: true, data: enrichedCalls});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Get call details for monitoring
app.get('/monitor/calls/:callId', authenticateSupervisor, async (req: any, res) => {
  try {
    const {callId} = req.params;

    const call = await prisma.call.findUnique({
      where: {id: callId},
      include: {
        agent: true,
        company: {
          select: {
            id: true,
            name: true
          }
        },
        transcript: true
      }
    });

    if (!call) {
      return res.status(404).json({success: false, error: 'Call not found'});
    }

    // Verify supervisor belongs to company
    if (req.user.companyId !== call.companyId) {
      return res.status(403).json({success: false, error: 'Access denied'});
    }

    // Check if being monitored
    const session = activeSessions.get(callId);

    res.json({
      success: true,
      data: {
        ...call,
        isBeingMonitored: !!session,
        monitorMode: session?.mode,
        monitoredBy: session?.supervisorId
      }
    });
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ LISTEN MODE (Silent Monitoring) ============

app.post('/monitor/listen', authenticateSupervisor, async (req: any, res) => {
  try {
    const {callId} = req.body;
    const supervisorId = req.user.id;

    const call = await prisma.call.findUnique({
      where: {id: callId}
    });

    if (!call) {
      return res.status(404).json({success: false, error: 'Call not found'});
    }

    if (req.user.companyId !== call.companyId) {
      return res.status(403).json({success: false, error: 'Access denied'});
    }

    // Check if call is active
    if (!['in-progress', 'talking'].includes(call.status)) {
      return res.status(400).json({success: false, error: 'Call is not active'});
    }

    // Create monitoring session
    const sessionId = `mon_${Date.now()}_${supervisorId}`;
    const session: MonitoringSession = {
      id: sessionId,
      supervisorId,
      callId,
      mode: 'listen',
      startedAt: new Date()
    };

    activeSessions.set(callId, session);

    // Log monitoring action
    await prisma.callMonitor.create({
      data: {
        callId,
        supervisorId,
        action: 'listen',
        startedAt: new Date()
      }
    });

    // TODO: Integrate with Twilio to join conference in listen mode
    // This would involve adding supervisor to the call conference with muted microphone

    res.json({
      success: true,
      data: {
        sessionId,
        message: 'Listening to call',
        callId,
        mode: 'listen'
      }
    });
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ WHISPER MODE (Coach Agent) ============

app.post('/monitor/whisper', authenticateSupervisor, async (req: any, res) => {
  try {
    const {callId} = req.body;
    const supervisorId = req.user.id;

    const call = await prisma.call.findUnique({
      where: {id: callId}
    });

    if (!call) {
      return res.status(404).json({success: false, error: 'Call not found'});
    }

    if (req.user.companyId !== call.companyId) {
      return res.status(403).json({success: false, error: 'Access denied'});
    }

    if (!['in-progress', 'talking'].includes(call.status)) {
      return res.status(400).json({success: false, error: 'Call is not active'});
    }

    // Create or update monitoring session
    const sessionId = `mon_${Date.now()}_${supervisorId}`;
    const session: MonitoringSession = {
      id: sessionId,
      supervisorId,
      callId,
      mode: 'whisper',
      startedAt: new Date()
    };

    activeSessions.set(callId, session);

    // Log monitoring action
    await prisma.callMonitor.create({
      data: {
        callId,
        supervisorId,
        action: 'whisper',
        startedAt: new Date()
      }
    });

    // TODO: Integrate with Twilio to enable whisper mode
    // Supervisor can hear both parties, but only agent can hear supervisor

    res.json({
      success: true,
      data: {
        sessionId,
        message: 'Whisper mode enabled - coaching agent',
        callId,
        mode: 'whisper'
      }
    });
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ BARGE MODE (Join Conversation) ============

app.post('/monitor/barge', authenticateSupervisor, async (req: any, res) => {
  try {
    const {callId} = req.body;
    const supervisorId = req.user.id;

    const call = await prisma.call.findUnique({
      where: {id: callId}
    });

    if (!call) {
      return res.status(404).json({success: false, error: 'Call not found'});
    }

    if (req.user.companyId !== call.companyId) {
      return res.status(403).json({success: false, error: 'Access denied'});
    }

    if (!['in-progress', 'talking'].includes(call.status)) {
      return res.status(400).json({success: false, error: 'Call is not active'});
    }

    // Create or update monitoring session
    const sessionId = `mon_${Date.now()}_${supervisorId}`;
    const session: MonitoringSession = {
      id: sessionId,
      supervisorId,
      callId,
      mode: 'barge',
      startedAt: new Date()
    };

    activeSessions.set(callId, session);

    // Log monitoring action
    await prisma.callMonitor.create({
      data: {
        callId,
        supervisorId,
        action: 'barge',
        startedAt: new Date()
      }
    });

    // TODO: Integrate with Twilio to enable barge mode
    // All three parties can hear each other

    res.json({
      success: true,
      data: {
        sessionId,
        message: 'Barge mode enabled - joined conversation',
        callId,
        mode: 'barge'
      }
    });
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ END MONITORING ============

app.post('/monitor/end', authenticateSupervisor, async (req: any, res) => {
  try {
    const {callId} = req.body;
    const supervisorId = req.user.id;

    const session = activeSessions.get(callId);

    if (!session) {
      return res.status(404).json({success: false, error: 'No active monitoring session'});
    }

    if (session.supervisorId !== supervisorId) {
      return res.status(403).json({success: false, error: 'Not your monitoring session'});
    }

    // Remove session
    activeSessions.delete(callId);

    // Update DB
    await prisma.callMonitor.updateMany({
      where: {
        callId,
        supervisorId,
        endedAt: null
      },
      data: {
        endedAt: new Date(),
        duration: Math.floor((Date.now() - session.startedAt.getTime()) / 1000)
      }
    });

    res.json({
      success: true,
      message: 'Monitoring session ended'
    });
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ MONITORING HISTORY ============

app.get('/monitor/history/:companyId', authenticateSupervisor, async (req: any, res) => {
  try {
    const {companyId} = req.params;
    const {limit = 100, offset = 0} = req.query;

    if (req.user.companyId !== companyId) {
      return res.status(403).json({success: false, error: 'Access denied'});
    }

    const history = await prisma.callMonitor.findMany({
      where: {
        call: {
          companyId
        }
      },
      include: {
        call: {
          select: {
            id: true,
            from: true,
            to: true,
            status: true,
            startTime: true,
            endTime: true
          }
        },
        supervisor: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {startedAt: 'desc'},
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    res.json({success: true, data: history});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ STATISTICS ============

app.get('/monitor/stats/:companyId', authenticateSupervisor, async (req: any, res) => {
  try {
    const {companyId} = req.params;
    const {startDate, endDate} = req.query;

    if (req.user.companyId !== companyId) {
      return res.status(403).json({success: false, error: 'Access denied'});
    }

    const where: any = {
      call: {companyId}
    };

    if (startDate || endDate) {
      where.startedAt = {
        gte: startDate ? new Date(startDate as string) : undefined,
        lte: endDate ? new Date(endDate as string) : undefined
      };
    }

    const total = await prisma.callMonitor.count({where});
    const listen = await prisma.callMonitor.count({where: {...where, action: 'listen'}});
    const whisper = await prisma.callMonitor.count({where: {...where, action: 'whisper'}});
    const barge = await prisma.callMonitor.count({where: {...where, action: 'barge'}});

    const avgDuration = await prisma.callMonitor.aggregate({
      where: {
        ...where,
        duration: {not: null}
      },
      _avg: {
        duration: true
      }
    });

    res.json({
      success: true,
      data: {
        total,
        byAction: {
          listen,
          whisper,
          barge
        },
        averageDuration: Math.round(avgDuration._avg.duration || 0),
        activeSessions: activeSessions.size
      }
    });
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ REAL-TIME DASHBOARD ============

app.get('/monitor/dashboard/:companyId', authenticateSupervisor, async (req: any, res) => {
  try {
    const {companyId} = req.params;

    if (req.user.companyId !== companyId) {
      return res.status(403).json({success: false, error: 'Access denied'});
    }

    // Active calls
    const activeCalls = await prisma.call.count({
      where: {
        companyId,
        status: {in: ['in-progress', 'talking']}
      }
    });

    // Active monitoring sessions
    const monitoringSessions = Array.from(activeSessions.values()).filter(s => {
      return s.supervisorId === req.user.id;
    });

    // Queue status
    const queueSize = await prisma.queueEntry.count({
      where: {
        queue: {
          companyId
        },
        status: 'waiting'
      }
    });

    // Available agents
    const availableAgents = await prisma.humanAgent.count({
      where: {
        companyId,
        status: {
          status: 'available'
        }
      }
    });

    res.json({
      success: true,
      data: {
        activeCalls,
        monitoringSessions: monitoringSessions.length,
        queueSize,
        availableAgents,
        sessions: monitoringSessions
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
    service: 'monitoring-service',
    timestamp: new Date().toISOString(),
    activeSessions: activeSessions.size
  });
});

app.listen(PORT, () => {
  console.log(`👁️ Monitoring Service running on port ${PORT}`);
});

export default app;
