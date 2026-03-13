import { Router } from 'express';
import twilio from 'twilio';
import { TwilioHandler } from '../handlers/twilio';
import { CallSessionManager } from '../managers/callSession';

export default (twilioHandler: TwilioHandler, sessionManager?: CallSessionManager) => {
  const router = Router();
  const VoiceResponse = twilio.twiml.VoiceResponse;

  // Incoming call webhook — full validation → IVR → queue fallback
  router.post('/voice/incoming', async (req, res) => {
    const response = new VoiceResponse();
    
    try {
      const { CallSid, From, To, Direction } = req.body;

      // ── Outbound call: session already exists, skip validation ──
      if (sessionManager) {
        const existingSession = await sessionManager.getSession(CallSid);
        if (existingSession && existingSession.direction === 'outbound') {
          // Outbound call answered — connect directly to AI stream
          await twilioHandler.handleIncomingCall({
            callSid: CallSid,
            from: From,
            to: To,
            agentConfig: { id: existingSession.agentId, companyId: existingSession.companyId }
          });

          const baseUrl = process.env.WEBHOOK_BASE_URL || `wss://${req.get('host')}`;
          const wsUrl = baseUrl.replace(/^https?:\/\//, 'wss://');

          const connect = response.connect();
          connect.stream({
            url: `${wsUrl}/stream/${CallSid}`
          });

          res.type('text/xml');
          return res.send(response.toString());
        }
      }
      
      // ── Step 1: Validate billing + concurrent limits + agent ──
      const validation = await twilioHandler.validateIncomingCall({
        callSid: CallSid,
        from: From,
        to: To
      });

      // ── Rejected: no agent found ──
      if (!validation.allowed && validation.reason === 'no_agent') {
        response.say({ voice: 'Polly.Amy' }, 
          'Sorry, this number is not currently in service. Please try again later.');
        response.hangup();
        res.type('text/xml');
        return res.send(response.toString());
      }

      // ── Rejected: no minutes remaining ──
      if (!validation.allowed && validation.reason === 'no_minutes') {
        response.say({ voice: 'Polly.Amy' }, 
          'We are unable to take your call at this time. Please try again later.');
        response.hangup();
        res.type('text/xml');
        return res.send(response.toString());
      }

      // ── Rejected: concurrent limit → queue fallback ──
      if (!validation.allowed && validation.reason === 'concurrent_limit') {
        if (validation.queueFallback && validation.agentConfig) {
          // Add to queue and play hold music
          await twilioHandler.addToQueue({
            callSid: CallSid,
            from: From,
            to: To,
            agentConfig: validation.agentConfig
          });

          response.say({ voice: 'Polly.Amy' }, 
            'All agents are currently busy. You have been placed in a queue. Please hold.');
          response.play({ loop: 10 }, 
            'https://api.twilio.com/cowbell.mp3');
        } else {
          response.say({ voice: 'Polly.Amy' }, 
            'All agents are currently busy. Please try again shortly.');
          response.hangup();
        }
        res.type('text/xml');
        return res.send(response.toString());
      }

      // ── Step 2: Check for IVR menu ──
      if (validation.ivrMenu && validation.ivrMenu.options?.length > 0) {
        // Play IVR greeting and gather DTMF input
        const gather = response.gather({
          numDigits: 1,
          action: `/voice/ivr-route?agentId=${validation.agentConfig.id}&companyId=${validation.agentConfig.companyId}&callSid=${CallSid}`,
          method: 'POST',
          timeout: 10
        });

        // Build IVR prompt from menu options
        let prompt = validation.ivrMenu.greeting || 'Welcome. ';
        for (const opt of validation.ivrMenu.options) {
          prompt += `Press ${opt.digit} for ${opt.label}. `;
        }
        gather.say({ voice: 'Polly.Amy' }, prompt);

        // If no input, connect directly
        response.redirect({ method: 'POST' }, 
          `/voice/connect?agentId=${validation.agentConfig.id}&companyId=${validation.agentConfig.companyId}&callSid=${CallSid}`);

        res.type('text/xml');
        return res.send(response.toString());
      }

      // ── Step 3: No IVR — connect directly to AI agent ──
      await twilioHandler.handleIncomingCall({
        callSid: CallSid,
        from: From,
        to: To,
        agentConfig: validation.agentConfig
      });

      const inboundBaseUrl = process.env.WEBHOOK_BASE_URL || `wss://${req.get('host')}`;
      const inboundWsUrl = inboundBaseUrl.replace(/^https?:\/\//, 'wss://');
      const connect = response.connect();
      connect.stream({
        url: `${inboundWsUrl}/stream/${CallSid}`
      });

      res.type('text/xml');
      res.send(response.toString());
    } catch (error) {
      console.error('Incoming call error:', error);
      response.say({ voice: 'Polly.Amy' }, 
        'We are experiencing technical difficulties. Please try again later.');
      res.type('text/xml');
      res.send(response.toString());
    }
  });

  // IVR DTMF route handler — after caller presses a digit
  router.post('/voice/ivr-route', async (req, res) => {
    const response = new VoiceResponse();
    const { Digits, CallSid: TwilioCallSid } = req.body;
    const agentId = req.query.agentId as string;
    const companyId = req.query.companyId as string;
    const callSid = req.query.callSid as string || TwilioCallSid;

    try {
      // Start session and connect to AI with IVR context
      await twilioHandler.handleIncomingCall({
        callSid,
        from: req.body.From || '',
        to: req.body.To || '',
        agentConfig: { id: agentId, companyId }
      });

      response.say({ voice: 'Polly.Amy' }, 'Connecting you now. Please hold.');

      const ivrBaseUrl = process.env.WEBHOOK_BASE_URL || `wss://${req.get('host')}`;
      const ivrWsUrl = ivrBaseUrl.replace(/^https?:\/\//, 'wss://');
      const connect = response.connect();
      connect.stream({
        url: `${ivrWsUrl}/stream/${callSid}`
      });
    } catch (error) {
      console.error('IVR route error:', error);
      response.say({ voice: 'Polly.Amy' }, 'We encountered an error. Please try again.');
      response.hangup();
    }

    res.type('text/xml');
    res.send(response.toString());
  });

  // Direct connect (skip IVR / no-input fallback)
  router.post('/voice/connect', async (req, res) => {
    const response = new VoiceResponse();
    const agentId = req.query.agentId as string;
    const companyId = req.query.companyId as string;
    const callSid = req.query.callSid as string || req.body.CallSid;

    try {
      await twilioHandler.handleIncomingCall({
        callSid,
        from: req.body.From || '',
        to: req.body.To || '',
        agentConfig: { id: agentId, companyId }
      });

      const connBaseUrl = process.env.WEBHOOK_BASE_URL || `wss://${req.get('host')}`;
      const connWsUrl = connBaseUrl.replace(/^https?:\/\//, 'wss://');
      const connect = response.connect();
      connect.stream({
        url: `${connWsUrl}/stream/${callSid}`
      });
    } catch (error) {
      console.error('Connect error:', error);
      response.say({ voice: 'Polly.Amy' }, 'We are experiencing difficulties.');
      response.hangup();
    }

    res.type('text/xml');
    res.send(response.toString());
  });

  // Call transfer endpoint
  router.post('/voice/transfer', async (req, res) => {
    try {
      const { callSid, targetAgentId, companyId } = req.body;
      const result = await twilioHandler.transferCall(callSid, targetAgentId, companyId);
      
      if (result.success) {
        res.json({ success: true, message: 'Call transferred successfully' });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: 'Transfer failed' });
    }
  });

  // Call status callback
  router.post('/voice/status', async (req, res) => {
    const { CallSid, CallStatus } = req.body;
    await twilioHandler.handleStatusChange(CallSid, CallStatus);
    res.sendStatus(200);
  });

  // Recording callback
  router.post('/voice/recording', async (req, res) => {
    const { CallSid, RecordingUrl, RecordingDuration } = req.body;
    await twilioHandler.handleRecording(CallSid, RecordingUrl, RecordingDuration);
    res.sendStatus(200);
  });

  return router;
};
