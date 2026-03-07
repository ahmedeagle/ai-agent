import express from 'express';
import { PrismaClient } from '@prisma/client';
import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.IVR_SERVICE_PORT || 3010;

const VoiceResponse = twilio.twiml.VoiceResponse;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============ IVR MENU MANAGEMENT ============

// Create IVR menu
app.post('/ivr/menu', async (req, res) => {
  try {
    const {
      name,
      companyId,
      entryPrompt,
      language,
      timeout,
      maxRetries,
      options
    } = req.body;

    const menu = await prisma.iVRMenu.create({
      data: {
        name,
        companyId,
        entryPrompt,
        language: language || 'en',
        timeout: timeout || 5,
        maxRetries: maxRetries || 3,
        options: options || []
      }
    });

    res.json({success: true, data: menu});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Get IVR menu
app.get('/ivr/menu/:id', async (req, res) => {
  try {
    const {id} = req.params;
    const menu = await prisma.iVRMenu.findUnique({where: {id}});
    res.json({success: true, data: menu});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Get company's active IVR menu
app.get('/ivr/company/:companyId', async (req, res) => {
  try {
    const {companyId} = req.params;
    const {language} = req.query;

    let where: any = {companyId, active: true};
    if (language) {
      where.language = language;
    }

    const menu = await prisma.iVRMenu.findFirst({
      where,
      orderBy: {createdAt: 'desc'}
    });

    res.json({success: true, data: menu});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Update IVR menu
app.put('/ivr/menu/:id', async (req, res) => {
  try {
    const {id} = req.params;
    const menu = await prisma.iVRMenu.update({
      where: {id},
      data: req.body
    });
    res.json({success: true, data: menu});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Delete IVR menu
app.delete('/ivr/menu/:id', async (req, res) => {
  try {
    const {id} = req.params;
    await prisma.iVRMenu.delete({where: {id}});
    res.json({success: true});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ IVR CALL HANDLING (TWILIO WEBHOOKS) ============

// Main IVR entry point - called when call comes in
app.post('/ivr/entry/:companyId', async (req, res) => {
  try {
    const {companyId} = req.params;
    const {CallSid, From, To} = req.body;

    // Get active IVR menu for company
    const menu = await prisma.iVRMenu.findFirst({
      where: {companyId, active: true},
      orderBy: {createdAt: 'desc'}
    });

    if (!menu) {
      // No IVR configured, route directly to AI
      const twiml = new VoiceResponse();
      twiml.say('Connecting you to an agent.');
      twiml.redirect(`${process.env.API_URL}/voice/handle`);
      res.type('text/xml');
      return res.send(twiml.toString());
    }

    // Create IVR session
    await prisma.iVRSession.create({
      data: {
        callSid: CallSid,
        menuId: menu.id,
        selections: []
      }
    });

    // Build TwiML for IVR menu
    const twiml = new VoiceResponse();
    
    // Recording consent (if enabled)
    if (process.env.RECORDING_CONSENT === 'true') {
      twiml.say('This call may be recorded for quality and training purposes.');
      twiml.pause({length: 1});
    }

    // Gather input
    const gather = twiml.gather({
      numDigits: 1,
      action: `${process.env.API_URL}/ivr/process/${menu.id}?CallSid=${CallSid}`,
      timeout: menu.timeout,
      method: 'POST'
    });

    // Read menu prompt
    if (menu.language === 'ar') {
      gather.say({language: 'ar-SA'}, menu.entryPrompt);
    } else {
      gather.say({language: 'en-US'}, menu.entryPrompt);
    }

    // If no input, retry
    twiml.redirect(`${process.env.API_URL}/ivr/retry/${menu.id}?CallSid=${CallSid}`);

    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error: any) {
    console.error('IVR entry error:', error);
    res.status(500).json({success: false, error: error.message});
  }
});

// Process IVR selection
app.post('/ivr/process/:menuId', async (req, res) => {
  try {
    const {menuId} = req.params;
    const {CallSid, Digits} = req.body;

    const menu = await prisma.iVRMenu.findUnique({where: {id: menuId}});
    if (!menu) {
      throw new Error('Menu not found');
    }

    // Update session with selection
    const session = await prisma.iVRSession.findFirst({
      where: {callSid: CallSid, menuId}
    });

    if (session) {
      const selections = Array.isArray(session.selections) ? session.selections : [];
      selections.push({
        menu: menu.name,
        selection: Digits,
        timestamp: new Date().toISOString()
      });

      await prisma.iVRSession.update({
        where: {id: session.id},
        data: {selections}
      });
    }

    // Find selected option
    const options = Array.isArray(menu.options) ? menu.options : [];
    const selectedOption = options.find((opt: any) => opt.key === Digits);

    const twiml = new VoiceResponse();

    if (!selectedOption) {
      // Invalid selection
      twiml.say('Invalid selection. Please try again.');
      twiml.redirect(`${process.env.API_URL}/ivr/entry/${menu.companyId}`);
      res.type('text/xml');
      return res.send(twiml.toString());
    }

    // Execute action based on option
    switch (selectedOption.action) {
      case 'route_agent':
        // Route to specific AI agent
        twiml.say(`Connecting you to ${selectedOption.label}.`);
        twiml.redirect(`${process.env.API_URL}/voice/handle?agentId=${selectedOption.target}`);
        break;

      case 'route_human':
        // Route to human agent
        twiml.say(`Connecting you to a live agent.`);
        twiml.redirect(`${process.env.API_URL}/transfer/queue?skill=${selectedOption.target}`);
        break;

      case 'submenu':
        // Navigate to submenu
        twiml.redirect(`${process.env.API_URL}/ivr/submenu/${selectedOption.target}?CallSid=${CallSid}`);
        break;

      case 'voicemail':
        // Send to voicemail
        twiml.say('Please leave a message after the beep.');
        twiml.record({
          maxLength: 300,
          action: `${process.env.API_URL}/voicemail/save`,
          transcribe: true,
          transcribeCallback: `${process.env.API_URL}/voicemail/transcribe`
        });
        break;

      case 'callback':
        // Schedule callback
        twiml.say('A representative will call you back within 24 hours.');
        twiml.redirect(`${process.env.API_URL}/callback/schedule`);
        break;

      case 'language':
        // Switch language
        twiml.redirect(`${process.env.API_URL}/ivr/entry/${menu.companyId}?language=${selectedOption.target}`);
        break;

      default:
        twiml.say('This option is not available. Please try again.');
        twiml.redirect(`${process.env.API_URL}/ivr/entry/${menu.companyId}`);
    }

    // Mark session destination
    if (session) {
      await prisma.iVRSession.update({
        where: {id: session.id},
        data: {
          completed: true,
          finalDestination: selectedOption.target
        }
      });
    }

    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error: any) {
    console.error('IVR process error:', error);
    res.status(500).json({success: false, error: error.message});
  }
});

// Retry handler for no input
app.post('/ivr/retry/:menuId', async (req, res) => {
  try {
    const {menuId} = req.params;
    const {CallSid} = req.body;

    const menu = await prisma.iVRMenu.findUnique({where: {id: menuId}});
    const session = await prisma.iVRSession.findFirst({
      where: {callSid: CallSid, menuId}
    });

    if (!menu || !session) {
      throw new Error('Menu or session not found');
    }

    const selections = Array.isArray(session.selections) ? session.selections : [];
    const retryCount = selections.filter((s: any) => s.selection === 'timeout').length;

    const twiml = new VoiceResponse();

    if (retryCount >= menu.maxRetries) {
      // Max retries reached, route to default (AI agent or human)
      twiml.say('We are connecting you to an agent.');
      twiml.redirect(`${process.env.API_URL}/voice/handle`);
    } else {
      // Try again
      selections.push({
        menu: menu.name,
        selection: 'timeout',
        timestamp: new Date().toISOString()
      });

      await prisma.iVRSession.update({
        where: {id: session.id},
        data: {selections}
      });

      twiml.say('We did not receive your selection.');
      twiml.redirect(`${process.env.API_URL}/ivr/entry/${menu.companyId}`);
    }

    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error: any) {
    console.error('IVR retry error:', error);
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ IVR ANALYTICS ============

// Get IVR session analytics
app.get('/ivr/analytics/:companyId', async (req, res) => {
  try {
    const {companyId} = req.params;
    const {startDate, endDate} = req.query;

    const menus = await prisma.iVRMenu.findMany({
      where: {companyId},
      include: {
        sessions: {
          where: {
            createdAt: {
              gte: startDate ? new Date(startDate as string) : undefined,
              lte: endDate ? new Date(endDate as string) : undefined
            }
          }
        }
      }
    });

    // Analyze selections
    const analytics = menus.map(menu => {
      const sessions = menu.sessions;
      const totalSessions = sessions.length;
      const completedSessions = sessions.filter(s => s.completed).length;
      
      const selectionCounts: any = {};
      sessions.forEach(session => {
        const selections = Array.isArray(session.selections) ? session.selections : [];
        selections.forEach((sel: any) => {
          if (sel.selection !== 'timeout') {
            selectionCounts[sel.selection] = (selectionCounts[sel.selection] || 0) + 1;
          }
        });
      });

      return {
        menuId: menu.id,
        menuName: menu.name,
        totalSessions,
        completedSessions,
        completionRate: totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0,
        selectionCounts,
        avgRetries: sessions.reduce((sum, s) => {
          const selections = Array.isArray(s.selections) ? s.selections : [];
          return sum + selections.filter((sel: any) => sel.selection === 'timeout').length;
        }, 0) / totalSessions || 0
      };
    });

    res.json({success: true, data: analytics});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'ivr-service',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`📞 IVR Service running on port ${PORT}`);
});

export default app;
