import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// List all customers for a company
router.get('/company/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { search, segment, limit = '50', offset = '0' } = req.query;

    const where: any = { companyId };
    if (segment) where.segment = segment;
    if (search) {
      where.OR = [
        { phoneNumber: { contains: search as string } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
        include: { _count: { select: { smsMessages: true, whatsappMessages: true, emailMessages: true, notes: true } } },
      }),
      prisma.customer.count({ where }),
    ]);

    res.json({ success: true, data: customers, total });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single customer (360 view)
router.get('/:id', async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        notes: { orderBy: { createdAt: 'desc' }, take: 20 },
        smsMessages: { orderBy: { createdAt: 'desc' }, take: 10 },
        whatsappMessages: { orderBy: { createdAt: 'desc' }, take: 10 },
        emailMessages: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!customer) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: customer });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create customer
router.post('/', async (req, res) => {
  try {
    // Ensure companyId is present — prefer body, fall back to gateway auth header
    const companyId = req.body.companyId || req.headers['x-company-id'];
    if (!companyId) {
      return res.status(400).json({ success: false, error: 'companyId is required' });
    }
    const customer = await prisma.customer.create({
      data: { ...req.body, companyId }
    });
    res.status(201).json({ success: true, data: customer });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update customer
router.put('/:id', async (req, res) => {
  try {
    const customer = await prisma.customer.update({ where: { id: req.params.id }, data: req.body });
    res.json({ success: true, data: customer });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete customer
router.delete('/:id', async (req, res) => {
  try {
    await prisma.customer.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add note to customer
router.post('/:id/notes', async (req, res) => {
  try {
    const note = await prisma.customerNote.create({
      data: { customerId: req.params.id, ...req.body },
    });
    res.status(201).json({ success: true, data: note });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Import contacts (bulk)
router.post('/import', async (req, res) => {
  try {
    const { companyId, contacts } = req.body; // contacts: [{phoneNumber, email, firstName, lastName, segment, tags}]
    const results = { created: 0, updated: 0, failed: 0, errors: [] as string[] };

    for (const c of contacts) {
      try {
        await prisma.customer.upsert({
          where: { phoneNumber_companyId: { phoneNumber: c.phoneNumber, companyId } },
          create: { ...c, companyId },
          update: { ...c },
        });
        results.created++;
      } catch (e: any) {
        results.failed++;
        results.errors.push(`${c.phoneNumber}: ${e.message}`);
      }
    }

    res.json({ success: true, data: results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
