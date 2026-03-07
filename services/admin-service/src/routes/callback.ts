import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// List scheduled callbacks
router.get('/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { status = 'pending', limit = '50', offset = '0' } = req.query;

    const where: any = { companyId };
    if (status !== 'all') where.status = status;

    const [callbacks, total] = await Promise.all([
      prisma.scheduledCallback.findMany({
        where,
        orderBy: { scheduledFor: 'asc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.scheduledCallback.count({ where }),
    ]);

    res.json({ success: true, data: callbacks, total });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Schedule a callback
router.post('/', async (req, res) => {
  try {
    const callback = await prisma.scheduledCallback.create({ data: req.body });
    res.status(201).json({ success: true, data: callback });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update callback (reschedule / cancel)
router.put('/:id', async (req, res) => {
  try {
    const callback = await prisma.scheduledCallback.update({ where: { id: req.params.id }, data: req.body });
    res.json({ success: true, data: callback });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cancel callback
router.delete('/:id', async (req, res) => {
  try {
    await prisma.scheduledCallback.update({
      where: { id: req.params.id },
      data: { status: 'cancelled' },
    });
    res.json({ success: true, message: 'Cancelled' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get today's upcoming callbacks
router.get('/:companyId/today', async (req, res) => {
  try {
    const { companyId } = req.params;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const callbacks = await prisma.scheduledCallback.findMany({
      where: {
        companyId,
        status: 'pending',
        scheduledFor: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { scheduledFor: 'asc' },
    });

    res.json({ success: true, data: callbacks });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
