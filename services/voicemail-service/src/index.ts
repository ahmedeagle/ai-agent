import express from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.VOICEMAIL_SERVICE_PORT || 3017;

app.use(express.json());

// External service URLs
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const SMS_SERVICE_URL = process.env.SMS_SERVICE_URL || 'http://localhost:3011';
const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL || 'http://localhost:3013';

// ============ VOICEMAIL MANAGEMENT ============

// Create voicemail entry
app.post('/voicemail', async (req, res) => {
  try {
    const {
      callId,
      companyId,
      callerPhone,
      callerName,
      recordingUrl,
      duration
    } = req.body;

    const voicemail = await prisma.voicemail.create({
      data: {
        callId,
        companyId,
        callerPhone,
        callerName,
        recordingUrl,
        duration,
        status: 'new'
      }
    });

    // Trigger transcription
    if (recordingUrl) {
      transcribeVoicemail(voicemail.id, recordingUrl);
    }

    // Send notification
    await sendVoicemailNotification(voicemail);

    res.json({success: true, data: voicemail});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Get voicemails
app.get('/voicemail/:companyId', async (req, res) => {
  try {
    const {companyId} = req.params;
    const {status, limit = 50, offset = 0} = req.query;

    const where: any = {companyId};
    if (status) {
      where.status = status;
    }

    const voicemails = await prisma.voicemail.findMany({
      where,
      orderBy: {createdAt: 'desc'},
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      include: {
        call: {
          select: {
            id: true,
            status: true
          }
        }
      }
    });

    res.json({success: true, data: voicemails});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Get voicemail by ID
app.get('/voicemail/details/:voicemailId', async (req, res) => {
  try {
    const {voicemailId} = req.params;

    const voicemail = await prisma.voicemail.findUnique({
      where: {id: voicemailId},
      include: {
        call: true
      }
    });

    if (!voicemail) {
      throw new Error('Voicemail not found');
    }

    res.json({success: true, data: voicemail});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Mark voicemail as listened
app.post('/voicemail/:voicemailId/listen', async (req, res) => {
  try {
    const {voicemailId} = req.params;

    const voicemail = await prisma.voicemail.update({
      where: {id: voicemailId},
      data: {
        status: 'listened',
        listenedAt: new Date()
      }
    });

    res.json({success: true, data: voicemail});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Archive voicemail
app.post('/voicemail/:voicemailId/archive', async (req, res) => {
  try {
    const {voicemailId} = req.params;

    const voicemail = await prisma.voicemail.update({
      where: {id: voicemailId},
      data: {status: 'archived'}
    });

    res.json({success: true, data: voicemail});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Delete voicemail
app.delete('/voicemail/:voicemailId', async (req, res) => {
  try {
    const {voicemailId} = req.params;

    await prisma.voicemail.delete({
      where: {id: voicemailId}
    });

    res.json({success: true, message: 'Voicemail deleted'});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ TRANSCRIPTION ============

async function transcribeVoicemail(voicemailId: string, recordingUrl: string) {
  try {
    console.log(`🎙️ Transcribing voicemail ${voicemailId}...`);

    if (!DEEPGRAM_API_KEY) {
      console.error('Deepgram API key not configured');
      return;
    }

    // Download recording audio
    const audioResponse = await axios.get(recordingUrl, {
      responseType: 'arraybuffer'
    });

    // Transcribe using Deepgram
    const response = await axios.post(
      'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true',
      audioResponse.data,
      {
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': 'audio/wav'
        }
      }
    );

    const transcript = response.data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    const confidence = response.data?.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;

    // Update voicemail with transcription
    await prisma.voicemail.update({
      where: {id: voicemailId},
      data: {
        transcription: transcript,
        transcriptionConfidence: confidence
      }
    });

    console.log(`✅ Voicemail ${voicemailId} transcribed successfully`);

  } catch (error: any) {
    console.error('Transcription error:', error.message);
    
    await prisma.voicemail.update({
      where: {id: voicemailId},
      data: {
        transcription: '[Transcription failed]'
      }
    });
  }
}

// Manual transcription trigger
app.post('/voicemail/:voicemailId/transcribe', async (req, res) => {
  try {
    const {voicemailId} = req.params;

    const voicemail = await prisma.voicemail.findUnique({
      where: {id: voicemailId}
    });

    if (!voicemail) {
      throw new Error('Voicemail not found');
    }

    if (!voicemail.recordingUrl) {
      throw new Error('No recording URL available');
    }

    transcribeVoicemail(voicemail.id, voicemail.recordingUrl);

    res.json({success: true, message: 'Transcription started'});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ CALLBACK MANAGEMENT ============

// Schedule callback
app.post('/voicemail/:voicemailId/callback', async (req, res) => {
  try {
    const {voicemailId} = req.params;
    const {scheduledFor, notes} = req.body;

    const voicemail = await prisma.voicemail.update({
      where: {id: voicemailId},
      data: {
        callbackScheduled: true,
        callbackScheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        notes: notes || voicemail.notes
      }
    });

    // Create notification
    await prisma.notification.create({
      data: {
        companyId: voicemail.companyId,
        type: 'escalation',
        title: 'Callback Scheduled',
        message: `Callback scheduled for ${voicemail.callerName || voicemail.callerPhone}`,
        priority: 'medium',
        metadata: {
          voicemailId,
          scheduledFor
        }
      }
    });

    res.json({success: true, data: voicemail});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Mark callback as completed
app.post('/voicemail/:voicemailId/callback/complete', async (req, res) => {
  try {
    const {voicemailId} = req.params;

    const voicemail = await prisma.voicemail.update({
      where: {id: voicemailId},
      data: {
        callbackCompleted: true,
        status: 'completed'
      }
    });

    res.json({success: true, data: voicemail});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Get pending callbacks
app.get('/voicemail/:companyId/callbacks', async (req, res) => {
  try {
    const {companyId} = req.params;

    const callbacks = await prisma.voicemail.findMany({
      where: {
        companyId,
        callbackScheduled: true,
        callbackCompleted: false
      },
      orderBy: {callbackScheduledFor: 'asc'}
    });

    res.json({success: true, data: callbacks});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ NOTIFICATIONS ============

async function sendVoicemailNotification(voicemail: any) {
  try {
    // Get company details
    const company = await prisma.company.findUnique({
      where: {id: voicemail.companyId}
    });

    if (!company) {
      return;
    }

    // Create notification in DB
    await prisma.notification.create({
      data: {
        companyId: voicemail.companyId,
        type: 'alert',
        title: 'New Voicemail',
        message: `New voicemail from ${voicemail.callerName || voicemail.callerPhone}`,
        priority: 'high',
        metadata: {
          voicemailId: voicemail.id,
          callerPhone: voicemail.callerPhone,
          duration: voicemail.duration
        }
      }
    });

    // Send email notification if configured
    if (company.emailFrom) {
      try {
        await axios.post(`${EMAIL_SERVICE_URL}/email/send`, {
          companyId: voicemail.companyId,
          to: company.billingEmail || company.emailFrom,
          subject: 'New Voicemail Received',
          body: `You have received a new voicemail from ${voicemail.callerName || voicemail.callerPhone}.\n\nDuration: ${voicemail.duration} seconds\n\nPlease check your dashboard to listen.`,
          priority: 'high'
        });
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
      }
    }

    // Send SMS notification if configured
    if (company.twilioPhoneNumber) {
      try {
        await axios.post(`${SMS_SERVICE_URL}/sms/send`, {
          companyId: voicemail.companyId,
          to: company.twilioPhoneNumber,
          message: `New voicemail from ${voicemail.callerPhone}. Duration: ${voicemail.duration}s`
        });
      } catch (smsError) {
        console.error('Failed to send SMS notification:', smsError);
      }
    }

  } catch (error) {
    console.error('Error sending voicemail notification:', error);
  }
}

// ============ STATISTICS ============

app.get('/voicemail/:companyId/stats', async (req, res) => {
  try {
    const {companyId} = req.params;

    const total = await prisma.voicemail.count({where: {companyId}});
    const newCount = await prisma.voicemail.count({where: {companyId, status: 'new'}});
    const listenedCount = await prisma.voicemail.count({where: {companyId, status: 'listened'}});
    const archivedCount = await prisma.voicemail.count({where: {companyId, status: 'archived'}});
    const callbackPending = await prisma.voicemail.count({
      where: {
        companyId,
        callbackScheduled: true,
        callbackCompleted: false
      }
    });

    const voicemails = await prisma.voicemail.findMany({
      where: {companyId},
      select: {duration: true}
    });

    const totalDuration = voicemails.reduce((sum, v) => sum + (v.duration || 0), 0);
    const averageDuration = voicemails.length > 0 ? totalDuration / voicemails.length : 0;

    res.json({
      success: true,
      data: {
        total,
        new: newCount,
        listened: listenedCount,
        archived: archivedCount,
        callbackPending,
        totalDuration,
        averageDuration: Math.round(averageDuration)
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
    service: 'voicemail-service',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`📞 Voicemail Service running on port ${PORT}`);
});

export default app;
