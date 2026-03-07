import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// List notifications for a company
router.get('/:companyId', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const { read, type, limit = '50', offset = '0' } = req.query;

    const where: any = { companyId };
    if (read !== undefined) where.read = read === 'true';
    if (type) where.type = type;

    const [data, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.notification.count({ where }),
    ]);

    const unreadCount = await prisma.notification.count({
      where: { companyId, read: false },
    });

    res.json({ success: true, data, total, unreadCount });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mark single notification as read
router.put('/:id/read', async (req: Request, res: Response) => {
  try {
    const notification = await prisma.notification.update({
      where: { id: req.params.id },
      data: { read: true },
    });
    res.json({ success: true, data: notification });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mark all as read for a company
router.put('/:companyId/read-all', async (req: Request, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { companyId: req.params.companyId, read: false },
      data: { read: true },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a notification
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.notification.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create notification (internal use)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { companyId, type, title, message, priority, metadata } = req.body;
    const notification = await prisma.notification.create({
      data: { companyId, type, title, message, priority: priority || 'normal', metadata },
    });
    res.json({ success: true, data: notification });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
