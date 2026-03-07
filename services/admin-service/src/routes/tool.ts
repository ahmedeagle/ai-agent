import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Get all tools for a company
router.get('/', async (req, res) => {
  try {
    const { companyId } = req.query;

    const tools = await prisma.tool.findMany({
      where: { companyId: companyId as string },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { toolCalls: true } }
      }
    });

    res.json({ success: true, data: tools });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch tools' });
  }
});

// Get single tool
router.get('/:id', async (req, res) => {
  try {
    const tool = await prisma.tool.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { toolCalls: true } }
      }
    });

    if (!tool) {
      return res.status(404).json({ success: false, error: 'Tool not found' });
    }

    res.json({ success: true, data: tool });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch tool' });
  }
});

// Create tool
router.post('/', async (req, res) => {
  try {
    const { name, description, endpoint, method, apiKey, headers, parameters, active, companyId } = req.body;

    const tool = await prisma.tool.create({
      data: {
        name,
        description,
        endpoint,
        method: method || 'POST',
        apiKey,
        headers: headers || {},
        parameters: parameters || [],
        active: active ?? true,
        companyId
      }
    });

    res.status(201).json({ success: true, data: tool });
  } catch (error) {
    console.error('Create tool error:', error);
    res.status(500).json({ success: false, error: 'Failed to create tool' });
  }
});

// Update tool
router.put('/:id', async (req, res) => {
  try {
    const { name, description, endpoint, method, apiKey, headers, parameters, active } = req.body;

    const tool = await prisma.tool.update({
      where: { id: req.params.id },
      data: {
        name,
        description,
        endpoint,
        method,
        apiKey,
        headers,
        parameters,
        active
      }
    });

    res.json({ success: true, data: tool });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update tool' });
  }
});

// Delete tool
router.delete('/:id', async (req, res) => {
  try {
    await prisma.tool.delete({
      where: { id: req.params.id }
    });

    res.json({ success: true, message: 'Tool deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete tool' });
  }
});

export default router;
