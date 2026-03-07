import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { authMiddleware } from './middleware/auth';
import { rbacMiddleware } from './middleware/rbac';
import { rateLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import authRoutes from './routes/auth';
import healthRoutes from './routes/health';

dotenv.config();

const app = express();
const PORT = process.env.API_GATEWAY_PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiter);

// Logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Public routes
app.use('/api/auth', authRoutes);
app.use('/api/health', healthRoutes);

// Protected routes - require authentication
app.use('/api/voice', authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://localhost:${process.env.VOICE_SERVICE_PORT || 3001}`,
  changeOrigin: true,
  pathRewrite: { '^/api/voice': '' }
}));

app.use('/api/admin', authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://localhost:${process.env.ADMIN_SERVICE_PORT || 3004}`,
  changeOrigin: true,
  pathRewrite: { '^/api/admin': '' }
}));

app.use('/api/analytics', authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://localhost:${process.env.ANALYTICS_SERVICE_PORT || 8001}`,
  changeOrigin: true,
  pathRewrite: { '^/api/analytics': '' }
}));

app.use('/api/qa', authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://localhost:${process.env.QA_SERVICE_PORT || 8002}`,
  changeOrigin: true,
  pathRewrite: { '^/api/qa': '' }
}));

app.use('/api/knowledge-base', authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://localhost:${process.env.KNOWLEDGE_BASE_PORT || 3008}`,
  changeOrigin: true,
  pathRewrite: { '^/api/knowledge-base': '' }
}));

app.use('/api/transfer', authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://localhost:${process.env.TRANSFER_SERVICE_PORT || 3009}`,
  changeOrigin: true,
  pathRewrite: { '^/api/transfer': '' }
}));

app.use('/api/ivr', authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://localhost:${process.env.IVR_SERVICE_PORT || 3010}`,
  changeOrigin: true,
  pathRewrite: { '^/api/ivr': '' }
}));

app.use('/api/sms', authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://localhost:${process.env.SMS_SERVICE_PORT || 3011}`,
  changeOrigin: true,
  pathRewrite: { '^/api/sms': '' }
}));

app.use('/api/sentiment', authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://localhost:${process.env.SENTIMENT_SERVICE_PORT || 3012}`,
  changeOrigin: true,
  pathRewrite: { '^/api/sentiment': '' }
}));

app.use('/api/email', authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://localhost:${process.env.EMAIL_SERVICE_PORT || 3013}`,
  changeOrigin: true,
  pathRewrite: { '^/api/email': '' }
}));

app.use('/api/whatsapp', authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://localhost:${process.env.WHATSAPP_SERVICE_PORT || 3014}`,
  changeOrigin: true,
  pathRewrite: { '^/api/whatsapp': '' }
}));

app.use('/api/billing', authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://localhost:${process.env.BILLING_SERVICE_PORT || 3015}`,
  changeOrigin: true,
  pathRewrite: { '^/api/billing': '' }
}));

app.use('/api/campaigns', authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://localhost:${process.env.CAMPAIGNS_SERVICE_PORT || 3016}`,
  changeOrigin: true,
  pathRewrite: { '^/api/campaigns': '' }
}));

app.use('/api/voicemail', authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://localhost:${process.env.VOICEMAIL_SERVICE_PORT || 3017}`,
  changeOrigin: true,
  pathRewrite: { '^/api/voicemail': '' }
}));

app.use('/api/queue', authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://localhost:${process.env.QUEUE_SERVICE_PORT || 3018}`,
  changeOrigin: true,
  pathRewrite: { '^/api/queue': '' }
}));

app.use('/api/monitor', authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://localhost:${process.env.MONITORING_SERVICE_PORT || 3019}`,
  changeOrigin: true,
  pathRewrite: { '^/api/monitor': '' }
}));

app.use('/api/surveys', authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://localhost:${process.env.SURVEY_SERVICE_PORT || 3020}`,
  changeOrigin: true,
  pathRewrite: { '^/api/surveys': '' }
}));

app.use('/api/recording', authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://localhost:${process.env.RECORDING_SERVICE_PORT || 3003}`,
  changeOrigin: true,
  pathRewrite: { '^/api/recording': '' }
}));

app.use('/api/tools', authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://localhost:${process.env.TOOL_EXECUTION_PORT || 3005}`,
  changeOrigin: true,
  pathRewrite: { '^/api/tools': '' }
}));

app.use('/api/ai-engine', authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://localhost:${process.env.AI_ENGINE_PORT || 8000}`,
  changeOrigin: true,
  pathRewrite: { '^/api/ai-engine': '' }
}));

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 API Gateway running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
