import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const agentSchema = z.object({
  name: z.string(),
  language: z.string(),
  voice: z.string(),
  systemPrompt: z.string(),
  phoneNumber: z.string().optional(),
  tools: z.array(z.string()).default([]),
  knowledgeBase: z.string().optional(),
  escalationRules: z.any().optional()
});

// Create agent
router.post('/', async (req, res) => {
  try {
    const data = agentSchema.parse(req.body);
    const { companyId } = req.query;

    const agent = await prisma.agent.create({
      data: {
        ...data,
        companyId: companyId as string
      }
    });

    res.json({ success: true, data: agent });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create agent' 
    });
  }
});

// List agents
router.get('/', async (req, res) => {
  try {
    const { companyId } = req.query;
    
    const agents = await prisma.agent.findMany({
      where: { companyId: companyId as string }
    });

    res.json({ success: true, data: agents });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch agents' });
  }
});

// Get agent by phone number
router.get('/by-phone/:phoneNumber', async (req, res) => {
  try {
    const agent = await prisma.agent.findFirst({
      where: { phoneNumber: req.params.phoneNumber }
    });

    res.json({ success: true, data: agent });
  } catch (error) {
    res.status(404).json({ success: false, error: 'Agent not found' });
  }
});

// Update agent
router.put('/:id', async (req, res) => {
  try {
    const data = agentSchema.partial().parse(req.body);
    
    const agent = await prisma.agent.update({
      where: { id: req.params.id },
      data
    });

    res.json({ success: true, data: agent });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Failed to update agent' });
  }
});

// Delete agent
router.delete('/:id', async (req, res) => {
  try {
    await prisma.agent.delete({
      where: { id: req.params.id }
    });

    res.json({ success: true, message: 'Agent deleted' });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Failed to delete agent' });
  }
});

export default router;
