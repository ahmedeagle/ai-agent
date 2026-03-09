import express from 'express';
import dotenv from 'dotenv';
import agentRoutes from './routes/agent';
import callRoutes from './routes/call';
import companyRoutes from './routes/company';
import qaRulesRoutes from './routes/qaRules';
import qaResultsRoutes from './routes/qaResults';
import toolRoutes from './routes/tool';
import userRoutes from './routes/user';
import auditLogRoutes from './routes/auditLog';
import customerRoutes from './routes/customer';
import leadRoutes from './routes/lead';
import dncRoutes from './routes/dnc';
import callbackRoutes from './routes/callback';
import notificationRoutes from './routes/notification';
import knowledgeBaseRoutes from './routes/knowledgeBase';
import channelStatsRoutes from './routes/channelStats';
import { auditMiddleware } from './middleware/audit';

dotenv.config();

const app = express();
const PORT = process.env.ADMIN_SERVICE_PORT || 3004;

app.use(express.json());

// Automatic audit logging for all mutating operations
app.use(auditMiddleware);

app.use('/agent', agentRoutes);
app.use('/call', callRoutes);
app.use('/calls', callRoutes);  // Alias: frontend uses both /call and /calls
app.use('/company', companyRoutes);
app.use('/qa-rules', qaRulesRoutes);
app.use('/qa-results', qaResultsRoutes);
app.use('/tool', toolRoutes);
app.use('/user', userRoutes);
app.use('/audit-log', auditLogRoutes);
app.use('/customer', customerRoutes);
app.use('/lead', leadRoutes);
app.use('/dnc', dncRoutes);
app.use('/callback', callbackRoutes);
app.use('/notification', notificationRoutes);
app.use('/kb', knowledgeBaseRoutes);
app.use('/channel-stats', channelStatsRoutes);

app.get('/health', (req, res) => {
  res.json({ success: true, service: 'admin-service', status: 'healthy' });
});

app.listen(PORT, () => {
  console.log(`🚀 Admin Service running on port ${PORT}`);
});
