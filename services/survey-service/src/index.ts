import express from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.SURVEY_SERVICE_PORT || 3020;

app.use(express.json());

// External service URLs
const SMS_SERVICE_URL = process.env.SMS_SERVICE_URL || 'http://localhost:3011';
const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL || 'http://localhost:3013';
const VOICE_SERVICE_URL = process.env.VOICE_SERVICE_URL || 'http://localhost:3003';

// ============ SURVEY MANAGEMENT ============

// Create survey
app.post('/surveys', async (req, res) => {
  try {
    const {
      companyId,
      name,
      type,
      questions,
      triggerType,
      triggerCondition,
      isActive
    } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('Questions array is required');
    }

    const survey = await prisma.survey.create({
      data: {
        companyId,
        name,
        type: type || 'csat',
        questions,
        triggerType: triggerType || 'post_call',
        triggerCondition: triggerCondition || {},
        isActive: isActive !== undefined ? isActive : true
      }
    });

    res.json({success: true, data: survey});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Get surveys
app.get('/surveys/:companyId', async (req, res) => {
  try {
    const {companyId} = req.params;
    const {type, isActive} = req.query;

    const where: any = {companyId};
    if (type) {
      where.type = type;
    }
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const surveys = await prisma.survey.findMany({
      where,
      orderBy: {createdAt: 'desc'},
      include: {
        _count: {
          select: {
            responses: true
          }
        }
      }
    });

    res.json({success: true, data: surveys});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Get survey by ID
app.get('/surveys/details/:surveyId', async (req, res) => {
  try {
    const {surveyId} = req.params;

    const survey = await prisma.survey.findUnique({
      where: {id: surveyId},
      include: {
        responses: {
          orderBy: {createdAt: 'desc'},
          take: 100
        }
      }
    });

    if (!survey) {
      throw new Error('Survey not found');
    }

    res.json({success: true, data: survey});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Update survey
app.patch('/surveys/:surveyId', async (req, res) => {
  try {
    const {surveyId} = req.params;
    const {name, questions, triggerType, triggerCondition, isActive} = req.body;

    const survey = await prisma.survey.update({
      where: {id: surveyId},
      data: {
        name,
        questions,
        triggerType,
        triggerCondition,
        isActive
      }
    });

    res.json({success: true, data: survey});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Delete survey
app.delete('/surveys/:surveyId', async (req, res) => {
  try {
    const {surveyId} = req.params;

    await prisma.survey.delete({
      where: {id: surveyId}
    });

    res.json({success: true, message: 'Survey deleted'});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ POST-CALL SURVEY TRIGGER ============

// Trigger survey after call
app.post('/surveys/trigger', async (req, res) => {
  try {
    const {callId, companyId, channel = 'sms'} = req.body;

    // Get call details
    const call = await prisma.call.findUnique({
      where: {id: callId},
      include: {
        agent: true
      }
    });

    if (!call) {
      throw new Error('Call not found');
    }

    // Find active survey
    const survey = await prisma.survey.findFirst({
      where: {
        companyId,
        isActive: true,
        triggerType: 'post_call'
      }
    });

    if (!survey) {
      return res.json({
        success: true,
        message: 'No active post-call survey found'
      });
    }

    // Send survey via selected channel
    await sendSurvey(survey, call, channel);

    res.json({
      success: true,
      message: `Survey sent via ${channel}`,
      surveyId: survey.id
    });
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ SURVEY RESPONSES ============

// Submit survey response
app.post('/surveys/responses', async (req, res) => {
  try {
    const {
      surveyId,
      callId,
      phone,
      email,
      answers,
      score,
      feedback
    } = req.body;

    const response = await prisma.surveyResponse.create({
      data: {
        surveyId,
        callId,
        phone,
        email,
        answers: answers || {},
        score,
        feedback,
        completedAt: new Date()
      }
    });

    // Update survey stats
    await updateSurveyStats(surveyId);

    // Check for low score alert
    if (score && score <= 3) {
      await createLowScoreAlert(surveyId, callId, score, feedback);
    }

    res.json({success: true, data: response});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Get survey responses
app.get('/surveys/:surveyId/responses', async (req, res) => {
  try {
    const {surveyId} = req.params;
    const {limit = 100, offset = 0, minScore, maxScore} = req.query;

    const where: any = {surveyId};
    if (minScore !== undefined || maxScore !== undefined) {
      where.score = {
        gte: minScore ? parseInt(minScore as string) : undefined,
        lte: maxScore ? parseInt(maxScore as string) : undefined
      };
    }

    const responses = await prisma.surveyResponse.findMany({
      where,
      orderBy: {createdAt: 'desc'},
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      include: {
        call: {
          select: {
            id: true,
            startTime: true,
            duration: true,
            agent: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    res.json({success: true, data: responses});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Get response by ID
app.get('/surveys/responses/:responseId', async (req, res) => {
  try {
    const {responseId} = req.params;

    const response = await prisma.surveyResponse.findUnique({
      where: {id: responseId},
      include: {
        survey: true,
        call: {
          include: {
            agent: true
          }
        }
      }
    });

    res.json({success: true, data: response});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ STATISTICS & ANALYTICS ============

// Get survey statistics
app.get('/surveys/:surveyId/stats', async (req, res) => {
  try {
    const {surveyId} = req.params;

    const responses = await prisma.surveyResponse.findMany({
      where: {surveyId}
    });

    const totalResponses = responses.length;
    const scores = responses.filter(r => r.score !== null).map(r => r.score as number);
    
    const avgScore = scores.length > 0 
      ? scores.reduce((sum, s) => sum + s, 0) / scores.length 
      : 0;

    const scoreDistribution = {
      '1': scores.filter(s => s === 1).length,
      '2': scores.filter(s => s === 2).length,
      '3': scores.filter(s => s === 3).length,
      '4': scores.filter(s => s === 4).length,
      '5': scores.filter(s => s === 5).length
    };

    // CSAT calculation (% of 4 and 5 scores)
    const satisfiedCount = scores.filter(s => s >= 4).length;
    const csatScore = scores.length > 0 ? (satisfiedCount / scores.length) * 100 : 0;

    // NPS calculation (% promoters - % detractors)
    const promoters = scores.filter(s => s >= 9).length;
    const detractors = scores.filter(s => s <= 6).length;
    const npsScore = scores.length > 0 
      ? ((promoters - detractors) / scores.length) * 100 
      : 0;

    res.json({
      success: true,
      data: {
        totalResponses,
        averageScore: Math.round(avgScore * 100) / 100,
        csatScore: Math.round(csatScore * 100) / 100,
        npsScore: Math.round(npsScore * 100) / 100,
        scoreDistribution,
        responsesWithFeedback: responses.filter(r => r.feedback).length
      }
    });
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Get company-wide CSAT/NPS
app.get('/surveys/:companyId/analytics', async (req, res) => {
  try {
    const {companyId} = req.params;
    const {startDate, endDate, type} = req.query;

    // Get all surveys for company
    const where: any = {companyId};
    if (type) {
      where.type = type;
    }

    const surveys = await prisma.survey.findMany({where});
    const surveyIds = surveys.map(s => s.id);

    // Get responses
    const responseWhere: any = {
      surveyId: {in: surveyIds}
    };

    if (startDate || endDate) {
      responseWhere.createdAt = {
        gte: startDate ? new Date(startDate as string) : undefined,
        lte: endDate ? new Date(endDate as string) : undefined
      };
    }

    const responses = await prisma.surveyResponse.findMany({
      where: responseWhere
    });

    const totalResponses = responses.length;
    const scores = responses.filter(r => r.score !== null).map(r => r.score as number);
    
    const avgScore = scores.length > 0 
      ? scores.reduce((sum, s) => sum + s, 0) / scores.length 
      : 0;

    // CSAT
    const satisfiedCount = scores.filter(s => s >= 4).length;
    const csatScore = scores.length > 0 ? (satisfiedCount / scores.length) * 100 : 0;

    // NPS
    const promoters = scores.filter(s => s >= 9).length;
    const passives = scores.filter(s => s >= 7 && s <= 8).length;
    const detractors = scores.filter(s => s <= 6).length;
    const npsScore = scores.length > 0 
      ? ((promoters - detractors) / scores.length) * 100 
      : 0;

    res.json({
      success: true,
      data: {
        totalSurveys: surveys.length,
        totalResponses,
        averageScore: Math.round(avgScore * 100) / 100,
        csat: Math.round(csatScore * 100) / 100,
        nps: Math.round(npsScore * 100) / 100,
        promoters,
        passives,
        detractors
      }
    });
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ HELPER FUNCTIONS ============

async function sendSurvey(survey: any, call: any, channel: string) {
  try {
    const surveyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/survey/${survey.id}?callId=${call.id}`;

    if (channel === 'sms') {
      const message = `Thank you for calling! Please rate your experience: ${surveyUrl}`;
      
      await axios.post(`${SMS_SERVICE_URL}/sms/send`, {
        companyId: call.companyId,
        to: call.phone,
        message
      });
    } else if (channel === 'email') {
      const subject = 'How was your experience?';
      const body = `
        <h2>We'd love your feedback!</h2>
        <p>Thank you for contacting us. Please take a moment to rate your experience:</p>
        <p><a href="${surveyUrl}">Click here to complete the survey</a></p>
      `;

      await axios.post(`${EMAIL_SERVICE_URL}/email/send`, {
        companyId: call.companyId,
        to: call.phone, // Assuming phone field might contain email
        subject,
        body
      });
    } else if (channel === 'voice') {
      // Trigger IVR survey
      await axios.post(`${VOICE_SERVICE_URL}/ivr/survey`, {
        callId: call.id,
        surveyId: survey.id,
        questions: survey.questions
      });
    }
  } catch (error) {
    console.error(`Failed to send survey via ${channel}:`, error);
  }
}

async function updateSurveyStats(surveyId: string) {
  const responses = await prisma.surveyResponse.findMany({
    where: {surveyId}
  });

  const scores = responses.filter(r => r.score !== null).map(r => r.score as number);
  const avgScore = scores.length > 0 
    ? scores.reduce((sum, s) => sum + s, 0) / scores.length 
    : 0;

  await prisma.survey.update({
    where: {id: surveyId},
    data: {
      responseCount: responses.length,
      averageScore: avgScore
    }
  });
}

async function createLowScoreAlert(surveyId: string, callId: string, score: number, feedback?: string) {
  const survey = await prisma.survey.findUnique({
    where: {id: surveyId}
  });

  if (!survey) return;

  await prisma.notification.create({
    data: {
      companyId: survey.companyId,
      type: 'alert',
      title: 'Low Survey Score Alert',
      message: `Call ${callId} received a score of ${score}/10. ${feedback ? `Feedback: ${feedback}` : ''}`,
      priority: 'high',
      metadata: {
        surveyId,
        callId,
        score,
        feedback
      }
    }
  });
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'survey-service',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`📊 Survey & CSAT Service running on port ${PORT}`);
});

export default app;
