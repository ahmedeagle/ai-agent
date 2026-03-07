import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Get call logs
router.get('/', async (req, res) => {
  try {
    const { companyId, page = 1, limit = 50 } = req.query;
    
    const calls = await prisma.call.findMany({
      where: { companyId: companyId as string },
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        agent: true
      }
    });

    const total = await prisma.call.count({
      where: { companyId: companyId as string }
    });

    res.json({
      success: true,
      data: {
        calls,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch calls' });
  }
});

// Get call details
router.get('/:id', async (req, res) => {
  try {
    const call = await prisma.call.findUnique({
      where: { id: req.params.id },
      include: {
        agent: true,
        transcript: true,
        recording: true
      }
    });

    res.json({ success: true, data: call });
  } catch (error) {
    res.status(404).json({ success: false, error: 'Call not found' });
  }
});

// Get call analytics
router.get('/analytics/summary', async (req, res) => {
  try {
    const { companyId, startDate, endDate } = req.query;

    // This would typically call the Analytics Service
    // For now, return basic stats from Prisma
    const totalCalls = await prisma.call.count({
      where: {
        companyId: companyId as string,
        createdAt: {
          gte: startDate ? new Date(startDate as string) : undefined,
          lte: endDate ? new Date(endDate as string) : undefined
        }
      }
    });

    const completedCalls = await prisma.call.count({
      where: {
        companyId: companyId as string,
        status: 'completed',
        createdAt: {
          gte: startDate ? new Date(startDate as string) : undefined,
          lte: endDate ? new Date(endDate as string) : undefined
        }
      }
    });

    res.json({
      success: true,
      data: {
        totalCalls,
        completedCalls,
        failedCalls: totalCalls - completedCalls,
        successRate: totalCalls > 0 ? (completedCalls / totalCalls) * 100 : 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
});

export default router;
