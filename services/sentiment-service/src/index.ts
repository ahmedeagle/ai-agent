import express from 'express';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import axios from 'axios';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.SENTIMENT_SERVICE_PORT || 3012;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(express.json());

// ============ SENTIMENT ANALYSIS ============

// Analyze text sentiment
app.post('/sentiment/analyze', async (req, res) => {
  try {
    const {text, callId, timestamp} = req.body;

    // Use OpenAI to analyze sentiment
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a sentiment analysis expert. Analyze the following text and provide:
1. Overall sentiment (positive, negative, neutral)
2. Sentiment score (-1 to 1, where -1 is very negative, 0 is neutral, 1 is very positive)
3. Specific emotions detected (joy, anger, frustration, confusion, satisfaction, etc.)
4. Urgency level (low, medium, high, critical)
5. Escalation recommendation (true/false)
6. Key concerns or issues mentioned

Respond in JSON format.`
        },
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const analysis = JSON.parse(completion.choices[0].message.content || '{}');

    // Save to database if callId provided
    if (callId) {
      const sentimentLog = await prisma.sentimentLog.create({
        data: {
          callId,
          timestamp: timestamp ? new Date(timestamp) : new Date(),
          sentiment: analysis.sentiment || 'neutral',
          score: analysis.score || 0,
          emotions: analysis.emotions || [],
          urgency: analysis.urgency || 'low',
          text: text.substring(0, 500) // Store snippet
        }
      });

      // Check if escalation needed
      if (analysis.escalation || analysis.urgency === 'critical' || analysis.score < -0.7) {
        await triggerEscalation(callId, analysis);
      }

      res.json({
        success: true,
        data: {
          ...analysis,
          logId: sentimentLog.id
        }
      });
    } else {
      res.json({success: true, data: analysis});
    }
  } catch (error: any) {
    console.error('Sentiment analysis error:', error);
    res.status(500).json({success: false, error: error.message});
  }
});

// Analyze conversation batch (for real-time monitoring)
app.post('/sentiment/analyze-batch', async (req, res) => {
  try {
    const {messages, callId} = req.body;

    if (!Array.isArray(messages)) {
      throw new Error('Messages must be an array');
    }

    const analyses = [];

    for (const msg of messages) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'Analyze sentiment. Respond with JSON: {sentiment: string, score: number, emotions: string[], urgency: string}'
            },
            {
              role: 'user',
              content: msg.text
            }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' }
        });

        const analysis = JSON.parse(completion.choices[0].message.content || '{}');

        if (callId) {
          await prisma.sentimentLog.create({
            data: {
              callId,
              timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
              sentiment: analysis.sentiment || 'neutral',
              score: analysis.score || 0,
              emotions: analysis.emotions || [],
              urgency: analysis.urgency || 'low',
              text: msg.text.substring(0, 500)
            }
          });
        }

        analyses.push({
          messageIndex: msg.index || analyses.length,
          ...analysis
        });
      } catch (error) {
        console.error('Error analyzing message:', error);
        analyses.push({
          messageIndex: msg.index || analyses.length,
          sentiment: 'neutral',
          score: 0,
          error: 'Analysis failed'
        });
      }
    }

    // Calculate overall conversation sentiment
    const avgScore = analyses.reduce((sum, a) => sum + (a.score || 0), 0) / analyses.length;
    const overallSentiment = avgScore > 0.3 ? 'positive' : avgScore < -0.3 ? 'negative' : 'neutral';

    res.json({
      success: true,
      data: {
        analyses,
        overall: {
          sentiment: overallSentiment,
          score: avgScore,
          messagesAnalyzed: analyses.length
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Get real-time sentiment for active call
app.get('/sentiment/call/:callId/realtime', async (req, res) => {
  try {
    const {callId} = req.params;
    const {lastN = 10} = req.query;

    const logs = await prisma.sentimentLog.findMany({
      where: {callId},
      orderBy: {timestamp: 'desc'},
      take: parseInt(lastN as string)
    });

    if (logs.length === 0) {
      return res.json({
        success: true,
        data: {
          sentiment: 'neutral',
          score: 0,
          trend: 'stable',
          logs: []
        }
      });
    }

    const avgScore = logs.reduce((sum, log) => sum + log.score, 0) / logs.length;
    const recentScore = logs.slice(0, 3).reduce((sum, log) => sum + log.score, 0) / Math.min(3, logs.length);
    const olderScore = logs.slice(3, 6).reduce((sum, log) => sum + log.score, 0) / Math.max(1, logs.length - 3);

    let trend = 'stable';
    if (recentScore > olderScore + 0.2) trend = 'improving';
    else if (recentScore < olderScore - 0.2) trend = 'declining';

    res.json({
      success: true,
      data: {
        sentiment: avgScore > 0.3 ? 'positive' : avgScore < -0.3 ? 'negative' : 'neutral',
        score: avgScore,
        recentScore,
        trend,
        logs: logs.reverse()
      }
    });
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Get sentiment history for call
app.get('/sentiment/call/:callId', async (req, res) => {
  try {
    const {callId} = req.params;

    const logs = await prisma.sentimentLog.findMany({
      where: {callId},
      orderBy: {timestamp: 'asc'}
    });

    const summary = {
      totalLogs: logs.length,
      averageScore: logs.reduce((sum, log) => sum + log.score, 0) / logs.length || 0,
      sentimentDistribution: {
        positive: logs.filter(l => l.sentiment === 'positive').length,
        neutral: logs.filter(l => l.sentiment === 'neutral').length,
        negative: logs.filter(l => l.sentiment === 'negative').length
      },
      emotionsDetected: [...new Set(logs.flatMap(l => l.emotions))],
      urgencyLevels: {
        low: logs.filter(l => l.urgency === 'low').length,
        medium: logs.filter(l => l.urgency === 'medium').length,
        high: logs.filter(l => l.urgency === 'high').length,
        critical: logs.filter(l => l.urgency === 'critical').length
      }
    };

    res.json({
      success: true,
      data: {
        summary,
        timeline: logs
      }
    });
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ EMOTION DETECTION ============

// Detect emotions from voice (audio analysis)
app.post('/sentiment/voice-emotion', async (req, res) => {
  try {
    const {audioUrl, callId, timestamp} = req.body;

    // In production, you would use a voice emotion detection API
    // For now, we'll use a placeholder that could integrate with services like:
    // - Azure Cognitive Services Speech
    // - Amazon Transcribe with sentiment
    // - Hume AI
    // - AssemblyAI

    // Placeholder response
    const emotionData = {
      primary_emotion: 'neutral',
      confidence: 0.85,
      emotions: {
        joy: 0.2,
        anger: 0.1,
        frustration: 0.15,
        satisfaction: 0.25,
        confusion: 0.1,
        neutral: 0.2
      },
      tone: 'calm',
      speaking_rate: 'normal',
      volume: 'moderate'
    };

    res.json({
      success: true,
      data: emotionData,
      note: 'Voice emotion detection requires integration with audio analysis API'
    });
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ ESCALATION TRIGGERS ============

// Automatic escalation based on sentiment
async function triggerEscalation(callId: string, analysis: any) {
  try {
    const call = await prisma.call.findUnique({
      where: {id: callId},
      include: {company: true}
    });

    if (!call) return;

    // Create notification
    await prisma.notification.create({
      data: {
        companyId: call.companyId,
        type: 'escalation',
        title: 'Call Escalation Required',
        message: `Call ${callId} requires escalation. Sentiment: ${analysis.sentiment}, Score: ${analysis.score}. Urgency: ${analysis.urgency}`,
        priority: analysis.urgency === 'critical' ? 'high' : 'medium',
        metadata: {
          callId,
          sentiment: analysis.sentiment,
          score: analysis.score,
          urgency: analysis.urgency,
          concerns: analysis.concerns
        }
      }
    });

    // Notify transfer service
    try {
      await axios.post(`${process.env.TRANSFER_SERVICE_URL}/transfer/evaluate-escalation`, {
        callId,
        reason: 'negative_sentiment',
        sentiment: analysis
      });
    } catch (error) {
      console.error('Failed to notify transfer service:', error);
    }

    console.log(`🚨 Escalation triggered for call ${callId}`);
  } catch (error) {
    console.error('Escalation trigger error:', error);
  }
}

// Manual escalation request
app.post('/sentiment/escalate/:callId', async (req, res) => {
  try {
    const {callId} = req.params;
    const {reason, notes} = req.body;

    const call = await prisma.call.findUnique({
      where: {id: callId},
      include: {company: true}
    });

    if (!call) {
      throw new Error('Call not found');
    }

    await triggerEscalation(callId, {
      sentiment: 'negative',
      score: -0.8,
      urgency: 'high',
      concerns: [reason],
      notes
    });

    res.json({success: true, message: 'Escalation triggered'});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ ANALYTICS ============

// Get sentiment analytics for company
app.get('/sentiment/analytics/:companyId', async (req, res) => {
  try {
    const {companyId} = req.params;
    const {startDate, endDate} = req.query;

    // Get calls with sentiment data
    const calls = await prisma.call.findMany({
      where: {
        companyId,
        createdAt: {
          gte: startDate ? new Date(startDate as string) : undefined,
          lte: endDate ? new Date(endDate as string) : undefined
        }
      },
      include: {
        sentimentLogs: true
      }
    });

    const allLogs = calls.flatMap(c => c.sentimentLogs);

    const analytics = {
      totalCalls: calls.length,
      totalSentimentLogs: allLogs.length,
      averageScore: allLogs.reduce((sum, log) => sum + log.score, 0) / allLogs.length || 0,
      sentimentDistribution: {
        positive: allLogs.filter(l => l.sentiment === 'positive').length,
        neutral: allLogs.filter(l => l.sentiment === 'neutral').length,
        negative: allLogs.filter(l => l.sentiment === 'negative').length
      },
      urgencyDistribution: {
        low: allLogs.filter(l => l.urgency === 'low').length,
        medium: allLogs.filter(l => l.urgency === 'medium').length,
        high: allLogs.filter(l => l.urgency === 'high').length,
        critical: allLogs.filter(l => l.urgency === 'critical').length
      },
      topEmotions: getTopEmotions(allLogs),
      negativeCallsPercent: (calls.filter(c => {
        const avgScore = c.sentimentLogs.reduce((sum, l) => sum + l.score, 0) / c.sentimentLogs.length;
        return avgScore < -0.3;
      }).length / calls.length) * 100 || 0
    };

    res.json({success: true, data: analytics});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

function getTopEmotions(logs: any[]) {
  const emotionCounts: { [key: string]: number } = {};
  
  logs.forEach(log => {
    const emotions = Array.isArray(log.emotions) ? log.emotions : [];
    emotions.forEach((emotion: string) => {
      emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
    });
  });

  return Object.entries(emotionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([emotion, count]) => ({ emotion, count }));
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'sentiment-service',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`😊 Sentiment Service running on port ${PORT}`);
});

export default app;
