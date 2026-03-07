import express from 'express';
import { S3 } from 'aws-sdk';
import { MongoClient } from 'mongodb';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.RECORDING_SERVICE_PORT || 3003;

const prisma = new PrismaClient();
const s3 = new S3({
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_KEY,
  region: process.env.S3_REGION
});

const mongoClient = new MongoClient(process.env.MONGODB_URL!);
let mongodb: any;

app.use(express.json());

// Initialize MongoDB
mongoClient.connect().then((client) => {
  mongodb = client.db('ai_agent_logs');
  console.log('✅ MongoDB connected');
});

// Store call recording
app.post('/recording', async (req, res) => {
  try {
    const { callSid, recordingUrl, duration } = req.body;

    // Download recording from Twilio
    const response = await axios.get(recordingUrl, {
      responseType: 'arraybuffer',
      auth: {
        username: process.env.TWILIO_ACCOUNT_SID!,
        password: process.env.TWILIO_AUTH_TOKEN!
      }
    });

    const audioBuffer = Buffer.from(response.data);

    // Upload to S3
    const s3Key = `recordings/${callSid}.wav`;
    await s3.putObject({
      Bucket: process.env.S3_BUCKET!,
      Key: s3Key,
      Body: audioBuffer,
      ContentType: 'audio/wav'
    }).promise();

    const s3Url = `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${s3Key}`;

    // Store in database
    const call = await prisma.call.findUnique({
      where: { callSid }
    });

    if (call) {
      await prisma.recording.create({
        data: {
          callId: call.id,
          url: s3Url,
          duration,
          size: audioBuffer.length,
          format: 'wav'
        }
      });
    }

    res.json({
      success: true,
      data: { url: s3Url }
    });
  } catch (error) {
    console.error('Recording storage error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to store recording'
    });
  }
});

// Store call transcript
app.post('/transcript', async (req, res) => {
  try {
    const { callSid, transcript } = req.body;

    const call = await prisma.call.findUnique({
      where: { callSid }
    });

    if (!call) {
      return res.status(404).json({
        success: false,
        error: 'Call not found'
      });
    }

    // Store in MongoDB for full transcript
    await mongodb.collection('transcripts').insertOne({
      callId: call.id,
      callSid,
      entries: transcript,
      createdAt: new Date()
    });

    // Store reference in PostgreSQL
    await prisma.transcript.upsert({
      where: { callId: call.id },
      update: { entries: transcript },
      create: {
        callId: call.id,
        entries: transcript
      }
    });

    res.json({
      success: true,
      message: 'Transcript stored'
    });
  } catch (error) {
    console.error('Transcript storage error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to store transcript'
    });
  }
});

// Get recording
app.get('/recording/:callId', async (req, res) => {
  try {
    const recording = await prisma.recording.findFirst({
      where: { callId: req.params.callId }
    });

    if (!recording) {
      return res.status(404).json({
        success: false,
        error: 'Recording not found'
      });
    }

    // Generate signed URL for temporary access
    const signedUrl = s3.getSignedUrl('getObject', {
      Bucket: process.env.S3_BUCKET!,
      Key: recording.url.split('.com/')[1],
      Expires: 3600 // 1 hour
    });

    res.json({
      success: true,
      data: {
        ...recording,
        signedUrl
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recording'
    });
  }
});

// Get transcript
app.get('/transcript/:callId', async (req, res) => {
  try {
    const transcript = await prisma.transcript.findFirst({
      where: { callId: req.params.callId }
    });

    res.json({
      success: true,
      data: transcript
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transcript'
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ success: true, service: 'recording-service', status: 'healthy' });
});

app.listen(PORT, () => {
  console.log(`🚀 Recording Service running on port ${PORT}`);
});
