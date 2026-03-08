import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ============ DOCUMENTS ============

router.post('/document', async (req: Request, res: Response) => {
  try {
    const { companyId, name, type, category, content, fullContent, chunks, embeddings, size, wordCount, url } = req.body;
    const doc = await prisma.kBDocument.create({
      data: { companyId, name, type, category, content, fullContent, chunks: chunks || 0, embeddings: embeddings || 0, size, wordCount: wordCount || 0, url }
    });
    res.json({ success: true, data: doc });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/document', async (req: Request, res: Response) => {
  try {
    const { companyId, category } = req.query;
    const where: any = {};
    if (companyId) where.companyId = companyId;
    if (category) where.category = category;

    const docs = await prisma.kBDocument.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: docs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/document/:id', async (req: Request, res: Response) => {
  try {
    const doc = await prisma.kBDocument.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: doc });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/document/:id', async (req: Request, res: Response) => {
  try {
    await prisma.kBDocument.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Document deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search documents by keyword
router.post('/document/search', async (req: Request, res: Response) => {
  try {
    const { companyId, query, topK = 5 } = req.body;
    // Full-text search using Prisma contains
    const docs = await prisma.kBDocument.findMany({
      where: {
        companyId,
        OR: [
          { content: { contains: query, mode: 'insensitive' } },
          { fullContent: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: topK,
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: docs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ Q&A PAIRS ============

router.post('/qa', async (req: Request, res: Response) => {
  try {
    const { companyId, question, answer, category } = req.body;
    const qa = await prisma.kBQAPair.create({
      data: { companyId, question, answer, category }
    });
    res.json({ success: true, data: qa });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/qa', async (req: Request, res: Response) => {
  try {
    const { companyId, category } = req.query;
    const where: any = {};
    if (companyId) where.companyId = companyId;
    if (category) where.category = category;

    const pairs = await prisma.kBQAPair.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: pairs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/qa/:id', async (req: Request, res: Response) => {
  try {
    const { question, answer, category } = req.body;
    const qa = await prisma.kBQAPair.update({
      where: { id: req.params.id },
      data: { question, answer, category }
    });
    res.json({ success: true, data: qa });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/qa/:id', async (req: Request, res: Response) => {
  try {
    await prisma.kBQAPair.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Q&A pair deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/qa/bulk', async (req: Request, res: Response) => {
  try {
    const { companyId, pairs } = req.body;
    const created = await prisma.kBQAPair.createMany({
      data: pairs.map((p: any) => ({
        companyId,
        question: p.question,
        answer: p.answer,
        category: p.category
      }))
    });
    res.json({ success: true, data: { imported: created.count } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search Q&A pairs
router.post('/qa/search', async (req: Request, res: Response) => {
  try {
    const { companyId, query, topK = 5 } = req.body;
    const pairs = await prisma.kBQAPair.findMany({
      where: {
        companyId,
        OR: [
          { question: { contains: query, mode: 'insensitive' } },
          { answer: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: topK,
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: pairs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ TRAINING LOG ============

router.post('/training-log', async (req: Request, res: Response) => {
  try {
    const { companyId, type, details } = req.body;
    const log = await prisma.kBTrainingLog.create({
      data: { companyId, type, details }
    });
    res.json({ success: true, data: log });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/training-log', async (req: Request, res: Response) => {
  try {
    const { companyId, limit = '50' } = req.query;
    const where: any = {};
    if (companyId) where.companyId = companyId;

    const logs = await prisma.kBTrainingLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string)
    });
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ STATS ============

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.query;
    const where: any = {};
    if (companyId) where.companyId = companyId;

    const [docCount, qaCount, totalChunks, totalWords] = await Promise.all([
      prisma.kBDocument.count({ where }),
      prisma.kBQAPair.count({ where }),
      prisma.kBDocument.aggregate({ where, _sum: { chunks: true } }),
      prisma.kBDocument.aggregate({ where, _sum: { wordCount: true } })
    ]);

    res.json({
      success: true,
      data: {
        documents: docCount,
        qaPairs: qaCount,
        totalChunks: totalChunks._sum.chunks || 0,
        totalWords: totalWords._sum.wordCount || 0
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
