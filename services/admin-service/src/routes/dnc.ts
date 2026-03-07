import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// List DNC entries
router.get('/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { search, limit = '50', offset = '0' } = req.query;

    const where: any = { companyId };
    if (search) where.phoneNumber = { contains: search as string };

    const [entries, total] = await Promise.all([
      prisma.dNCEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.dNCEntry.count({ where }),
    ]);

    res.json({ success: true, data: entries, total });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check if number is on DNC
router.post('/check', async (req, res) => {
  try {
    const { companyId, phoneNumber } = req.body;
    const entry = await prisma.dNCEntry.findUnique({
      where: { companyId_phoneNumber: { companyId, phoneNumber } },
    });
    res.json({ success: true, blocked: !!entry, data: entry });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add to DNC
router.post('/', async (req, res) => {
  try {
    const entry = await prisma.dNCEntry.create({ data: req.body });
    res.status(201).json({ success: true, data: entry });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'Number already on DNC list' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// Remove from DNC
router.delete('/:id', async (req, res) => {
  try {
    await prisma.dNCEntry.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Removed from DNC' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Bulk import DNC numbers
router.post('/import', async (req, res) => {
  try {
    const { companyId, numbers, reason, addedBy } = req.body;
    let added = 0, skipped = 0;

    for (const phone of numbers) {
      try {
        await prisma.dNCEntry.create({
          data: { companyId, phoneNumber: phone, reason, addedBy, source: 'import' },
        });
        added++;
      } catch {
        skipped++;
      }
    }

    res.json({ success: true, data: { added, skipped } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
