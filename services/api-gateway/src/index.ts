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
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(rateLimiter);

// Logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Body parsing ONLY for non-proxied routes
app.use('/api/auth', express.json(), authRoutes);
app.use('/api/health', healthRoutes);

// Fix: restream body for proxied routes after auth/rbac parse it
const fixRequestBody = (proxyReq: any, req: any) => {
  if (req.body && Object.keys(req.body).length > 0) {
    const bodyData = JSON.stringify(req.body);
    proxyReq.setHeader('Content-Type', 'application/json');
    proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
    proxyReq.write(bodyData);
  }
};

// Parse body for auth/rbac middleware, then restream for proxy
const jsonParser = express.json();
const urlParser = express.urlencoded({ extended: true });

// Protected routes - require authentication
app.use('/api/voice', jsonParser, authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://voice-service:${process.env.VOICE_SERVICE_PORT || 3001}`,
  changeOrigin: true,
  pathRewrite: { '^/api/voice': '' },
  on: { proxyReq: fixRequestBody }
}));

app.use('/api/admin', jsonParser, authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://admin-service:${process.env.ADMIN_SERVICE_PORT || 3004}`,
  changeOrigin: true,
  pathRewrite: { '^/api/admin': '' },
  on: { proxyReq: fixRequestBody }
}));

app.use('/api/analytics', jsonParser, authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://analytics-service:${process.env.ANALYTICS_SERVICE_PORT || 8001}`,
  changeOrigin: true,
  pathRewrite: { '^/api/analytics': '' },
  on: { proxyReq: fixRequestBody }
}));

app.use('/api/qa', jsonParser, authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://qa-service:${process.env.QA_SERVICE_PORT || 8002}`,
  changeOrigin: true,
  pathRewrite: { '^/api/qa': '' },
  on: { proxyReq: fixRequestBody }
}));

app.use('/api/knowledge-base', jsonParser, authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://knowledge-base-service:${process.env.KNOWLEDGE_BASE_PORT || 3008}`,
  changeOrigin: true,
  pathRewrite: { '^/api/knowledge-base': '' },
  on: { proxyReq: fixRequestBody }
}));

app.use('/api/transfer', jsonParser, authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://transfer-service:${process.env.TRANSFER_SERVICE_PORT || 3009}`,
  changeOrigin: true,
  pathRewrite: { '^/api/transfer': '' },
  on: { proxyReq: fixRequestBody }
}));

app.use('/api/ivr', jsonParser, authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://ivr-service:${process.env.IVR_SERVICE_PORT || 3010}`,
  changeOrigin: true,
  pathRewrite: { '^/api/ivr': '' },
  on: { proxyReq: fixRequestBody }
}));

app.use('/api/sms', jsonParser, authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://sms-service:${process.env.SMS_SERVICE_PORT || 3011}`,
  changeOrigin: true,
  pathRewrite: { '^/api/sms': '' },
  on: { proxyReq: fixRequestBody }
}));

app.use('/api/sentiment', jsonParser, authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://sentiment-service:${process.env.SENTIMENT_SERVICE_PORT || 3012}`,
  changeOrigin: true,
  pathRewrite: { '^/api/sentiment': '' },
  on: { proxyReq: fixRequestBody }
}));

app.use('/api/email', jsonParser, authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://email-service:${process.env.EMAIL_SERVICE_PORT || 3013}`,
  changeOrigin: true,
  pathRewrite: { '^/api/email': '' },
  on: { proxyReq: fixRequestBody }
}));

app.use('/api/whatsapp', jsonParser, authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://whatsapp-service:${process.env.WHATSAPP_SERVICE_PORT || 3014}`,
  changeOrigin: true,
  pathRewrite: { '^/api/whatsapp': '' },
  on: { proxyReq: fixRequestBody }
}));

app.use('/api/billing', jsonParser, authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://billing-service:${process.env.BILLING_SERVICE_PORT || 3015}`,
  changeOrigin: true,
  pathRewrite: { '^/api/billing': '' },
  on: { proxyReq: fixRequestBody }
}));

app.use('/api/campaigns', jsonParser, authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://campaigns-service:${process.env.CAMPAIGNS_SERVICE_PORT || 3016}`,
  changeOrigin: true,
  pathRewrite: { '^/api/campaigns': '' },
  on: { proxyReq: fixRequestBody }
}));

app.use('/api/voicemail', jsonParser, authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://voicemail-service:${process.env.VOICEMAIL_SERVICE_PORT || 3017}`,
  changeOrigin: true,
  pathRewrite: { '^/api/voicemail': '' },
  on: { proxyReq: fixRequestBody }
}));

app.use('/api/queue', jsonParser, authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://queue-service:${process.env.QUEUE_SERVICE_PORT || 3018}`,
  changeOrigin: true,
  pathRewrite: { '^/api/queue': '' },
  on: { proxyReq: fixRequestBody }
}));

app.use('/api/monitor', jsonParser, authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://monitoring-service:${process.env.MONITORING_SERVICE_PORT || 3019}`,
  changeOrigin: true,
  pathRewrite: { '^/api/monitor': '' },
  on: { proxyReq: fixRequestBody }
}));

app.use('/api/surveys', jsonParser, authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://survey-service:${process.env.SURVEY_SERVICE_PORT || 3020}`,
  changeOrigin: true,
  pathRewrite: { '^/api/surveys': '' },
  on: { proxyReq: fixRequestBody }
}));

app.use('/api/recording', jsonParser, authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://recording-service:${process.env.RECORDING_SERVICE_PORT || 3003}`,
  changeOrigin: true,
  pathRewrite: { '^/api/recording': '' },
  on: { proxyReq: fixRequestBody }
}));

app.use('/api/tools', jsonParser, authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://tool-execution-service:${process.env.TOOL_EXECUTION_PORT || 3005}`,
  changeOrigin: true,
  pathRewrite: { '^/api/tools': '' },
  on: { proxyReq: fixRequestBody }
}));

app.use('/api/ai-engine', authMiddleware, rbacMiddleware, createProxyMiddleware({
  target: `http://ai-engine-service:${process.env.AI_ENGINE_PORT || 8000}`,
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
