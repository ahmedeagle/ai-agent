import { Router } from 'express';

const router = Router();

router.get('/', async (req, res) => {
  res.json({
    success: true,
    service: 'api-gateway',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

export default router;
