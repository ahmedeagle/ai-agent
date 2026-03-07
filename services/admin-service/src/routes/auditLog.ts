import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Create audit log entry
router.post('/', async (req, res) => {
  try {
    const {
      userId,
      userEmail,
      userRole,
      companyId,
      action,
      resource,
      resourceId,
      details,
      ipAddress,
      userAgent,
    } = req.body;

    const log = await prisma.auditLog.create({
      data: {
        userId,
        userEmail,
        userRole,
        companyId,
        action,
        resource,
        resourceId,
        details,
        ipAddress,
        userAgent,
      },
    });

    res.status(201).json({ success: true, data: log });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to create audit log' });
  }
});

// List audit logs for a company
router.get('/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const {
      limit = '50',
      offset = '0',
      action,
      resource,
      userId,
      startDate,
      endDate,
    } = req.query;

    const where: any = { companyId };

    if (action) where.action = action;
    if (resource) where.resource = resource;
    if (userId) where.userId = userId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ success: true, data: logs, total });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch audit logs' });
  }
});

// Get audit log stats (summary by action/resource)
router.get('/:companyId/stats', async (req, res) => {
  try {
    const { companyId } = req.params;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const recentLogs = await prisma.auditLog.findMany({
      where: {
        companyId,
        createdAt: { gte: sevenDaysAgo },
      },
    });

    const byAction: Record<string, number> = {};
    const byResource: Record<string, number> = {};
    const byUser: Record<string, { email: string; count: number }> = {};

    for (const log of recentLogs) {
      byAction[log.action] = (byAction[log.action] || 0) + 1;
      byResource[log.resource] = (byResource[log.resource] || 0) + 1;
      if (!byUser[log.userId]) {
        byUser[log.userId] = { email: log.userEmail, count: 0 };
      }
      byUser[log.userId].count++;
    }

    res.json({
      success: true,
      data: {
        totalLast7Days: recentLogs.length,
        byAction,
        byResource,
        topUsers: Object.values(byUser)
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch audit stats' });
  }
});

export default router;
