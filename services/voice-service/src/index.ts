import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { TwilioHandler } from './handlers/twilio';
import { CallSessionManager } from './managers/callSession';
import { initRabbitMQ } from './utils/rabbitmq';
import webhookRoutes from './routes/webhook';
import callRoutes from './routes/call';
import { setupMediaStreamWebSocket } from './handlers/mediaStream';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.VOICE_SERVICE_PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize managers
const callSessionManager = new CallSessionManager(io);
const twilioHandler = new TwilioHandler(callSessionManager);

// Routes
app.use('/webhook', webhookRoutes(twilioHandler, callSessionManager));
app.use('/call', callRoutes(callSessionManager));

app.get('/health', (req, res) => {
  res.json({ 
    success: true,
    service: 'voice-service',
    status: 'healthy' 
  });
});

// WebSocket for real-time communication
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  socket.on('join-company', (companyId: string) => {
    socket.join(`company-${companyId}`);
    logger.info(`Socket ${socket.id} joined company room: company-${companyId}`);
  });

  socket.on('join-call', (callId: string) => {
    socket.join(`call-${callId}`);
    logger.info(`Socket ${socket.id} joined call ${callId}`);
  });

  socket.on('leave-call', (callId: string) => {
    socket.leave(`call-${callId}`);
    logger.info(`Socket ${socket.id} left call ${callId}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Initialize RabbitMQ
initRabbitMQ().then(() => {
  logger.info('✅ RabbitMQ connected');
}).catch((error) => {
  logger.error('Failed to connect to RabbitMQ:', error);
});

// Setup Twilio Media Stream WebSocket handler
setupMediaStreamWebSocket(httpServer, callSessionManager);

// Start server
httpServer.listen(PORT, () => {
  logger.info(`🚀 Voice Service running on port ${PORT}`);
});

export { io };
