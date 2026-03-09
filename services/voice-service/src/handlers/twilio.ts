import axios from 'axios';
import { logger } from '../utils/logger';
import { CallSessionManager } from '../managers/callSession';
import { publishEvent } from '../utils/rabbitmq';

const IVR_SERVICE_URL = `http://ivr-service:${process.env.IVR_SERVICE_PORT || 3010}`;
const QUEUE_SERVICE_URL = `http://queue-service:${process.env.QUEUE_SERVICE_PORT || 3018}`;
const TRANSFER_SERVICE_URL = `http://transfer-service:${process.env.TRANSFER_SERVICE_PORT || 3009}`;
const ADMIN_SERVICE_URL = `http://admin-service:${process.env.ADMIN_SERVICE_PORT || 3004}`;
const AI_ENGINE_URL = `http://ai-engine-service:${process.env.AI_ENGINE_PORT || 8000}`;

export interface CallValidation {
  allowed: boolean;
  reason?: string; // 'concurrent_limit' | 'no_minutes' | 'no_agent'
  agentConfig?: any;
  ivrMenu?: any;
  queueFallback?: boolean;
}

export class TwilioHandler {
  private sessionManager: CallSessionManager;

  constructor(sessionManager: CallSessionManager) {
    this.sessionManager = sessionManager;
  }

  /**
   * Full pre-call validation: agent lookup → billing check → IVR check
   * Returns a CallValidation object so the webhook route can build the right TwiML
   */
  async validateIncomingCall(data: {
    callSid: string;
    from: string;
    to: string;
  }): Promise<CallValidation> {
    try {
      // 1. Get agent config from phone number
      const agentConfig = await this.getAgentConfig(data.to);
      if (!agentConfig) {
        return { allowed: false, reason: 'no_agent' };
      }

      // 2. Check billing: concurrent limits + minutes remaining
      const billingCheck = await this.sessionManager.checkCallAllowed(agentConfig.companyId);
      if (!billingCheck.allowed) {
        // If concurrent limit hit, try to queue instead of rejecting
        if (billingCheck.reason === 'concurrent_limit') {
          return {
            allowed: false,
            reason: 'concurrent_limit',
            agentConfig,
            queueFallback: true
          };
        }
        return { allowed: false, reason: billingCheck.reason, agentConfig };
      }

      // 3. Check if company has IVR menu configured
      let ivrMenu = null;
      try {
        const ivrRes = await axios.get(`${IVR_SERVICE_URL}/ivr/company/${agentConfig.companyId}`);
        if (ivrRes.data?.data?.length > 0) {
          ivrMenu = ivrRes.data.data[0]; // Use first active IVR menu
        }
      } catch {
        // No IVR configured — that's fine, connect directly
      }

      return { allowed: true, agentConfig, ivrMenu };
    } catch (error) {
      logger.error('Error validating incoming call:', error);
      return { allowed: false, reason: 'no_agent' };
    }
  }

  /**
   * Start call session after validation passes (called once IVR routing is complete or skipped)
   */
  async handleIncomingCall(data: {
    callSid: string;
    from: string;
    to: string;
    agentConfig: any;
  }): Promise<void> {
    try {
      logger.info(`Accepting call: ${data.callSid} from ${data.from}`);

      // Create call session (also increments billing concurrent agents)
      await this.sessionManager.createSession({
        callSid: data.callSid,
        from: data.from,
        to: data.to,
        agentId: data.agentConfig?.id,
        companyId: data.agentConfig?.companyId,
        direction: 'inbound'
      });

      // Trigger AI processing (non-blocking — don't fail the call if AI engine is down)
      try {
        await axios.post(`${AI_ENGINE_URL}/process-call`, {
          callSid: data.callSid,
          agentId: data.agentConfig?.id
        });
      } catch (aiError) {
        logger.warn('AI engine not available, call will connect without AI processing:', 
          aiError instanceof Error ? aiError.message : 'Unknown error');
      }
    } catch (error) {
      logger.error('Error handling incoming call:', error);
      throw error;
    }
  }

  /**
   * Add caller to queue when concurrent limit is reached
   */
  async addToQueue(data: {
    callSid: string;
    from: string;
    to: string;
    agentConfig: any;
    priority?: number;
  }): Promise<void> {
    try {
      await axios.post(`${QUEUE_SERVICE_URL}/queue/add`, {
        callSid: data.callSid,
        callerNumber: data.from,
        calledNumber: data.to,
        companyId: data.agentConfig.companyId,
        agentId: data.agentConfig.id,
        priority: data.priority || 5
      });
      logger.info(`Call ${data.callSid} added to queue`);
    } catch (error) {
      logger.error('Error adding call to queue:', error);
    }
  }

  /**
   * Transfer an active call to another agent or human
   */
  async transferCall(callSid: string, targetAgentId: string, companyId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Check agent availability
      const availRes = await axios.get(`${TRANSFER_SERVICE_URL}/agents/available`, {
        params: { companyId }
      });

      const available = availRes.data.data || [];
      const targetAgent = available.find((a: any) => a.id === targetAgentId);

      if (!targetAgent) {
        return { success: false, error: 'Target agent is not available' };
      }

      // Mark target agent as busy
      await axios.put(`${TRANSFER_SERVICE_URL}/agents/${targetAgentId}/status`, {
        status: 'busy',
        callSid
      });

      // Update session with new agent
      await this.sessionManager.updateSession(callSid, { agentId: targetAgentId });
      await publishEvent('call.transferred', { callSid, targetAgentId, companyId });

      logger.info(`Call ${callSid} transferred to agent ${targetAgentId}`);
      return { success: true };
    } catch (error) {
      logger.error('Error transferring call:', error);
      return { success: false, error: 'Transfer service unavailable' };
    }
  }

  async handleStatusChange(callSid: string, status: string): Promise<void> {
    logger.info(`Call ${callSid} status: ${status}`);

    const statusMap: Record<string, any> = {
      'initiated': { status: 'initiated' },
      'ringing': { status: 'ringing' },
      'in-progress': { status: 'in-progress' },
      'completed': { status: 'completed' },
      'busy': { status: 'failed' },
      'failed': { status: 'failed' },
      'no-answer': { status: 'failed' }
    };

    if (statusMap[status]) {
      await this.sessionManager.updateSession(callSid, statusMap[status]);
    }

    if (status === 'completed') {
      await this.sessionManager.endSession(callSid);
    } else if (['busy', 'failed', 'no-answer'].includes(status)) {
      // For failed calls, also notify campaigns service and clean up
      await this.sessionManager.handleFailedCall(callSid, status);
    }
  }

  async handleRecording(
    callSid: string,
    recordingUrl: string,
    duration: number
  ): Promise<void> {
    logger.info(`Recording available for call ${callSid}: ${recordingUrl}`);

    await publishEvent('recording.available', {
      callSid,
      recordingUrl,
      duration
    });
  }

  private async getAgentConfig(phoneNumber: string): Promise<any> {
    try {
      const response = await axios.get(
        `${ADMIN_SERVICE_URL}/agent/by-phone/${phoneNumber}`
      );
      return response.data.data;
    } catch (error) {
      logger.error('Error getting agent config:', error);
      return null;
    }
  }
}
