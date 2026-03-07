import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ============ QA RESULTS CRUD ============

// Save automated QA result
router.post('/', async (req, res) => {
  try {
    const { callId, automatedScore, ruleResults, compliancePassed, complianceIssues } = req.body;

    const result = await prisma.qAResult.upsert({
      where: { callId },
      create: {
        callId,
        automatedScore,
        ruleResults,
        compliancePassed: compliancePassed ?? true,
        complianceIssues: complianceIssues || []
      },
      update: {
        automatedScore,
        ruleResults,
        compliancePassed: compliancePassed ?? true,
        complianceIssues: complianceIssues || []
      }
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get QA result for a call
router.get('/:callId', async (req, res) => {
  try {
    const { callId } = req.params;

    const result = await prisma.qAResult.findUnique({
      where: { callId },
      include: {
        call: {
          select: {
            from: true,
            to: true,
            direction: true,
            duration: true,
            agentId: true,
            status: true
          }
        }
      }
    });

    if (!result) {
      return res.status(404).json({ success: false, error: 'QA result not found' });
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save/update manual review
router.put('/:callId', async (req, res) => {
  try {
    const { callId } = req.params;
    const { manualScore, reviewComments, reviewerId } = req.body;

    const result = await prisma.qAResult.upsert({
      where: { callId },
      create: {
        callId,
        manualScore,
        reviewComments,
        reviewerId,
        reviewedAt: new Date()
      },
      update: {
        manualScore,
        reviewComments,
        reviewerId,
        reviewedAt: new Date()
      }
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get agent QA summary
router.get('/agent/:agentId/summary', async (req, res) => {
  try {
    const { agentId } = req.params;

    const results = await prisma.qAResult.findMany({
      where: {
        call: { agentId }
      },
      select: {
        automatedScore: true,
        manualScore: true,
        compliancePassed: true,
        ruleResults: true
      }
    });

    const totalEvaluations = results.length;
    const scores = results
      .filter(r => r.automatedScore !== null)
      .map(r => r.automatedScore as number);

    const averageScore = scores.length > 0
      ? scores.reduce((sum, s) => sum + s, 0) / scores.length
      : 0;

    const passCount = scores.filter(s => s >= 70).length;
    const passRate = scores.length > 0 ? (passCount / scores.length) * 100 : 0;

    const complianceFailures = results.filter(r => !r.compliancePassed).length;

    res.json({
      success: true,
      data: {
        agentId,
        totalEvaluations,
        averageScore: Math.round(averageScore * 100) / 100,
        passRate: Math.round(passRate * 100) / 100,
        complianceFailures,
        commonIssues: []
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
