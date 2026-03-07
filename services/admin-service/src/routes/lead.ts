import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// List leads for company
router.get('/company/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { stage, source, assignedTo, priority, search, limit = '50', offset = '0' } = req.query;

    const where: any = { companyId };
    if (stage) where.stage = stage;
    if (source) where.source = source;
    if (assignedTo) where.assignedTo = assignedTo;
    if (priority) where.priority = priority;
    if (search) {
      where.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string } },
        { company: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.lead.count({ where }),
    ]);

    res.json({ success: true, data: leads, total });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get pipeline summary (count per stage)
router.get('/pipeline/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const stages = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];

    const counts: Record<string, any> = {};
    for (const stage of stages) {
      const [count, value] = await Promise.all([
        prisma.lead.count({ where: { companyId, stage } }),
        prisma.lead.aggregate({ where: { companyId, stage }, _sum: { estimatedValue: true } }),
      ]);
      counts[stage] = { count, value: value._sum.estimatedValue || 0 };
    }

    const totalLeads = await prisma.lead.count({ where: { companyId } });
    const totalValue = await prisma.lead.aggregate({ where: { companyId, stage: { notIn: ['lost'] } }, _sum: { estimatedValue: true } });

    res.json({
      success: true,
      data: { stages: counts, totalLeads, totalPipelineValue: totalValue._sum.estimatedValue || 0 },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create lead
router.post('/', async (req, res) => {
  try {
    const lead = await prisma.lead.create({ data: req.body });
    res.status(201).json({ success: true, data: lead });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update lead (including stage changes)
router.put('/:id', async (req, res) => {
  try {
    const updates: any = { ...req.body };
    if (req.body.stage === 'won') updates.wonAt = new Date();
    if (req.body.stage === 'lost') updates.lostAt = new Date();
    if (req.body.stage && !['won', 'lost'].includes(req.body.stage)) {
      updates.lastContactedAt = new Date();
    }

    const lead = await prisma.lead.update({ where: { id: req.params.id }, data: updates });
    res.json({ success: true, data: lead });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete lead
router.delete('/:id', async (req, res) => {
  try {
    await prisma.lead.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
