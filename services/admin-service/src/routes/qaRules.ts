import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ============ QA RULES CRUD ============

// Create QA rule
router.post('/', async (req, res) => {
  try {
    const { name, description, required, active, companyId, agentId } = req.body;

    const rule = await prisma.qARule.create({
      data: {
        name,
        description,
        required: required ?? true,
        active: active ?? true,
        companyId,
        agentId: agentId || null
      }
    });

    res.json({ success: true, data: rule });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get QA rules for a company (optionally filtered by agent)
router.get('/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { agentId } = req.query;

    const where: any = { companyId };
    if (agentId) {
      where.agentId = agentId as string;
    }

    const rules = await prisma.qARule.findMany({
      where,
      orderBy: { createdAt: 'asc' }
    });

    res.json({ success: true, data: rules });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update QA rule
router.put('/:ruleId', async (req, res) => {
  try {
    const { ruleId } = req.params;
    const { name, description, required, active } = req.body;

    const rule = await prisma.qARule.update({
      where: { id: ruleId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(required !== undefined && { required }),
        ...(active !== undefined && { active })
      }
    });

    res.json({ success: true, data: rule });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete QA rule
router.delete('/:ruleId', async (req, res) => {
  try {
    const { ruleId } = req.params;
    await prisma.qARule.delete({ where: { id: ruleId } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
