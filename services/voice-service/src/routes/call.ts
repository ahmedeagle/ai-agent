import { Router } from 'express';
import { CallSessionManager } from '../managers/callSession';
import twilio from 'twilio';

export default (sessionManager: CallSessionManager) => {
  const router = Router();
  // Lazy Twilio init - only create client when credentials exist
  function getClient() {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token || !sid.startsWith('AC')) {
      throw new Error('Twilio credentials not configured');
    }
    return twilio(sid, token);
  }
  let client: ReturnType<typeof twilio> | null = null;
  try { client = getClient(); } catch(e) { console.warn('Twilio not configured - voice call features disabled'); }

  // Initiate outbound call
  router.post('/outbound', async (req, res) => {
    try {
      const { to, agentId, companyId } = req.body;

      // Use public webhook URL - req.get('host') returns internal Docker hostname
      const baseUrl = process.env.WEBHOOK_BASE_URL || `https://${req.get('host')}`;

      const call = await client.calls.create({
        to,
        from: process.env.TWILIO_PHONE_NUMBER!,
        url: `${baseUrl}/webhook/voice/incoming`,
        statusCallback: `${baseUrl}/webhook/voice/status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        record: true,
        recordingStatusCallback: `${baseUrl}/webhook/voice/recording`
      });

      // Store call metadata
      await sessionManager.createSession({
        callSid: call.sid,
        to,
        from: process.env.TWILIO_PHONE_NUMBER!,
        agentId,
        companyId,
        direction: 'outbound'
      });

      res.json({
        success: true,
        data: {
          callSid: call.sid,
          status: call.status
        }
      });
    } catch (error) {
      console.error('Outbound call error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initiate call'
      });
    }
  });

  // Get active calls
  router.get('/active', async (req, res) => {
    try {
      const { companyId } = req.query;
      const activeCalls = await sessionManager.getActiveCalls(companyId as string);
      
      res.json({
        success: true,
        data: activeCalls
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch active calls'
      });
    }
  });

  // End call
  router.post('/:callSid/end', async (req, res) => {
    try {
      const { callSid } = req.params;
      
      await client.calls(callSid).update({ status: 'completed' });
      await sessionManager.endSession(callSid);

      res.json({
        success: true,
        message: 'Call ended'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to end call'
      });
    }
  });

  return router;
};
