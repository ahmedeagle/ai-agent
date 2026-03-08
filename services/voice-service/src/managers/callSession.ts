import { Server } from 'socket.io';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { publishEvent } from '../utils/rabbitmq';
import axios from 'axios';

const redis = new Redis(process.env.REDIS_URL!);

const BILLING_SERVICE_URL = `http://billing-service:${process.env.BILLING_SERVICE_PORT || 3015}`;

interface CallSession {
  id: string;
  callSid: string;
  from: string;
  to: string;
  agentId?: string;
  companyId: string;
  direction: 'inbound' | 'outbound';
  status: 'initiated' | 'ringing' | 'in-progress' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  transcript: Array<{
    speaker: 'ai' | 'user';
    text: string;
    timestamp: Date;
  }>;
}

export class CallSessionManager {
  private io: Server;
  
  constructor(io: Server) {
    this.io = io;
  }

  /**
   * Check if company has remaining minutes and concurrent agent slots
   * Returns { allowed, reason } — used by webhook to reject or queue the call
   */
  async checkCallAllowed(companyId: string): Promise<{ allowed: boolean; reason?: string; remainingSlots?: number }> {
    try {
      // Check concurrent agent limit
      const concurrentRes = await axios.post(`${BILLING_SERVICE_URL}/billing/concurrent-agents/check`, { companyId });
      const concurrentData = concurrentRes.data.data;

      if (!concurrentData.canStart) {
        return {
          allowed: false,
          reason: 'concurrent_limit',
          remainingSlots: 0
        };
      }

      // Check minutes remaining
      const activePackageRes = await axios.get(`${BILLING_SERVICE_URL}/billing/packages/${companyId}/active`);
      const activePackage = activePackageRes.data.data;

      if (activePackage && activePackage.minutesRemaining <= 0) {
        return {
          allowed: false,
          reason: 'no_minutes',
          remainingSlots: concurrentData.remainingSlots
        };
      }

      return {
        allowed: true,
        remainingSlots: concurrentData.remainingSlots
      };
    } catch (error) {
      logger.error('Billing check failed, allowing call as fallback:', error);
      // Fail-open: allow call if billing service is unreachable
      return { allowed: true };
    }
  }

  async createSession(data: Partial<CallSession>): Promise<CallSession> {
    const session: CallSession = {
      id: uuidv4(),
      callSid: data.callSid!,
      from: data.from!,
      to: data.to!,
      agentId: data.agentId,
      companyId: data.companyId!,
      direction: data.direction!,
      status: 'initiated',
      startTime: new Date(),
      transcript: []
    };

    // Store in Redis using company-scoped set for O(1) lookups
    await redis.setex(
      `call:${session.callSid}`,
      3600, // 1 hour TTL
      JSON.stringify(session)
    );
    // Track active calls per company in a Redis Set
    await redis.sadd(`company:${session.companyId}:active_calls`, session.callSid);

    // Increment concurrent agent count in billing
    try {
      await axios.post(`${BILLING_SERVICE_URL}/billing/concurrent-agents/increment`, {
        companyId: session.companyId
      });
    } catch (error) {
      logger.error('Failed to increment concurrent agents:', error);
    }

    // Notify via Socket.IO
    this.io.to(`company-${session.companyId}`).emit('call:started', session);

    // Publish to RabbitMQ
    await publishEvent('call.started', session);

    logger.info(`Call session created: ${session.id}`);
    return session;
  }

  async getSession(callSid: string): Promise<CallSession | null> {
    const data = await redis.get(`call:${callSid}`);
    return data ? JSON.parse(data) : null;
  }

  async updateSession(callSid: string, updates: Partial<CallSession>): Promise<void> {
    const session = await this.getSession(callSid);
    if (!session) return;

    const updated = { ...session, ...updates };
    await redis.setex(`call:${callSid}`, 3600, JSON.stringify(updated));

    this.io.to(`company-${session.companyId}`).emit('call:updated', updated);
    await publishEvent('call.updated', updated);
  }

  async addTranscript(callSid: string, speaker: 'ai' | 'user', text: string): Promise<void> {
    const session = await this.getSession(callSid);
    if (!session) return;

    session.transcript.push({
      speaker,
      text,
      timestamp: new Date()
    });

    await redis.setex(`call:${callSid}`, 3600, JSON.stringify(session));
    
    this.io.to(`call-${callSid}`).emit('transcript', {
      speaker,
      text,
      timestamp: new Date()
    });
  }

  async endSession(callSid: string): Promise<void> {
    const session = await this.getSession(callSid);
    if (!session) return;

    session.status = 'completed';
    session.endTime = new Date();

    // Calculate duration in minutes
    const durationMs = new Date(session.endTime).getTime() - new Date(session.startTime).getTime();
    const durationMinutes = Math.ceil(durationMs / 60000); // Round up to nearest minute

    await redis.setex(`call:${callSid}`, 86400, JSON.stringify(session)); // Keep for 24h
    // Remove from active calls set
    await redis.srem(`company:${session.companyId}:active_calls`, callSid);

    // Decrement concurrent agent count and log usage
    try {
      await axios.post(`${BILLING_SERVICE_URL}/billing/concurrent-agents/decrement`, {
        companyId: session.companyId
      });

      // Log call minutes usage (deducts from package, creates usage log, alerts at 80%)
      await axios.post(`${BILLING_SERVICE_URL}/billing/usage/call`, {
        companyId: session.companyId,
        callId: session.id,
        durationMinutes
      });

      logger.info(`Billed ${durationMinutes} minutes for call ${callSid}`);
    } catch (error) {
      logger.error('Failed to log billing usage:', error);
    }
    
    this.io.to(`company-${session.companyId}`).emit('call:ended', session);
    await publishEvent('call.completed', session);

    logger.info(`Call session ended: ${session.id}`);
  }

  async getActiveCalls(companyId: string): Promise<CallSession[]> {
    // Use company-scoped Redis Set instead of scanning all keys
    const callSids = await redis.smembers(`company:${companyId}:active_calls`);
    const calls: CallSession[] = [];

    for (const sid of callSids) {
      const data = await redis.get(`call:${sid}`);
      if (data) {
        const session = JSON.parse(data);
        if (session.status === 'in-progress' || session.status === 'ringing' || session.status === 'initiated') {
          calls.push(session);
        } else {
          // Clean up stale entries
          await redis.srem(`company:${companyId}:active_calls`, sid);
        }
      } else {
        // Key expired, clean up set
        await redis.srem(`company:${companyId}:active_calls`, sid);
      }
    }

    return calls;
  }
}
