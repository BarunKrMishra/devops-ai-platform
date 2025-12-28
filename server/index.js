import './config/env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import winston from 'winston';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import authRoutes from './routes/auth.js';
import cicdRoutes from './routes/cicd.js';
import infrastructureRoutes from './routes/infrastructure.js';
import monitoringRoutes from './routes/monitoring.js';
import aiRoutes from './routes/ai.js';
import auditRoutes from './routes/audit.js';
import templatesRoutes from './routes/templates.js';
import notificationsRoutes from './routes/notifications.js';
import organizationsRoutes from './routes/organizations.js';
import webhooksRoutes from './routes/webhooks.js';
import alertsRoutes from './routes/alerts.js';
import healthRoutes from './routes/health.js';
import onboardingRoutes from './routes/onboarding.js';
import integrationsRoutes, { oauthCallbackRouter } from './routes/integrations.js';
import teamsRoutes from './routes/teams.js';
import invitesRoutes from './routes/invites.js';
import usersRoutes from './routes/users.js';
import { authenticateToken } from './middleware/auth.js';
import { initDatabase } from './database/init.js';
import { startUsageMetricsJob } from './jobs/usageMetrics.js';

// Environment variables
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 3001;

// CORS configuration - handle both string and array formats
const defaultOrigins = ['http://localhost:5173', 'http://localhost:5174'];
const appBaseOrigin = process.env.APP_BASE_URL;
let CORS_ORIGIN = process.env.CORS_ORIGIN;

if (typeof CORS_ORIGIN === 'string') {
  // If CORS_ORIGIN is a string, split by comma for multiple origins
  CORS_ORIGIN = CORS_ORIGIN.split(',').map(origin => origin.trim());
}

if (!Array.isArray(CORS_ORIGIN)) {
  CORS_ORIGIN = [];
}

const includeLocalhost = process.env.ALLOW_LOCALHOST_CORS !== 'false';

CORS_ORIGIN = Array.from(new Set([
  ...(includeLocalhost ? defaultOrigins : []),
  appBaseOrigin,
  ...CORS_ORIGIN
].filter(Boolean)));

// Add common Netlify domains if not already included
const commonNetlifyDomains = [
  'https://*.netlify.app',
  'https://*.netlify.com'
];

// Only add Netlify domains if we're in production and they're not already included
if (NODE_ENV === 'production' && !CORS_ORIGIN.some(origin => origin.includes('netlify'))) {
  CORS_ORIGIN = [...CORS_ORIGIN, ...commonNetlifyDomains];
}

console.log('CORS Origins configured:', CORS_ORIGIN);

const RATE_LIMIT_WINDOW_MS = process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX || 100; // Limit each IP to 100 requests per windowMs

// Configure logger
const logger = winston.createLogger({
  level: NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

const app = express();
const server = createServer(app);

// Trust proxy for rate limiting behind reverse proxy (Render, etc.)
app.set('trust proxy', 1);

// Configure Socket.IO with security measures
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true,
  }
});

// Security middleware
app.use(helmet());
app.use(cors({
  origin: CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request ID middleware
app.use((req, res, next) => {
  const requestId = crypto.randomBytes(8).toString('hex');
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      request_id: req.requestId
    });
  });
  next();
});

// Initialize database
await initDatabase();
startUsageMetricsJob();

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }
  if (!process.env.JWT_SECRET) {
    return next(new Error('Authentication service unavailable'));
  }
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

// Routes
// Health check route (no authentication required)
app.use('/api/health', healthRoutes);
app.use('/api/invites', invitesRoutes);

// Protected routes
app.use('/api/auth', authRoutes);
app.use('/api/cicd', authenticateToken, cicdRoutes);
app.use('/api/infrastructure', authenticateToken, infrastructureRoutes);
app.use('/api/monitoring', authenticateToken, monitoringRoutes);
app.use('/api/ai', authenticateToken, aiRoutes);
app.use('/api/audit', authenticateToken, auditRoutes);
app.use('/api/templates', authenticateToken, templatesRoutes);
app.use('/api/notifications', authenticateToken, notificationsRoutes);
app.use('/api/organizations', authenticateToken, organizationsRoutes);
app.use('/api/users', authenticateToken, usersRoutes);
app.use('/api/teams', authenticateToken, teamsRoutes);
app.use('/api/webhooks', authenticateToken, webhooksRoutes);
app.use('/api/alerts', authenticateToken, alertsRoutes);
app.use('/api/onboarding', authenticateToken, onboardingRoutes);
app.use('/api/integrations/oauth', oauthCallbackRouter);
app.use('/api/integrations', authenticateToken, integrationsRoutes);

// WebSocket connection handling with improved security and error handling
io.on('connection', (socket) => {
  logger.info(`User connected: ${socket.id}, User: ${socket.user?.email}`);
  
  // Rate limiting for socket events
  const eventCount = new Map();
  const EVENT_LIMIT = 50;
  const EVENT_WINDOW = 10000; // 10 seconds

  socket.use(([event, ...args], next) => {
    const now = Date.now();
    if (!eventCount.has(event)) {
      eventCount.set(event, []);
    }
    const events = eventCount.get(event);
    events.push(now);
    const recentEvents = events.filter(time => now - time < EVENT_WINDOW);
    eventCount.set(event, recentEvents);
    
    if (recentEvents.length > EVENT_LIMIT) {
      next(new Error('Rate limit exceeded'));
    } else {
      next();
    }
  });
  
  socket.on('join-room', (userId) => {
    if (socket.user.id === userId) {
    socket.join(`user-${userId}`);
    }
  });

  socket.on('join-org', (orgId) => {
    if (socket.user.organization_id === orgId) {
    socket.join(`org-${orgId}`);
    }
  });

  socket.on('join-project', (projectId) => {
    // TODO: Add project access verification
    socket.join(`project-${projectId}`);
  });

  socket.on('error', (error) => {
    logger.error('Socket error:', error);
  });

  socket.on('disconnect', (reason) => {
    logger.info(`User disconnected: ${socket.id}, Reason: ${reason}`);
  });
});

// Global error handler with proper error logging
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    request_id: req.requestId
  });

  // Don't expose error details in production
  const error = NODE_ENV === 'production' 
    ? 'An unexpected error occurred' 
    : err.message;

  res.status(err.status || 500).json({ error });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

server.listen(PORT, () => {
  logger.info(`Server running in ${NODE_ENV} mode on port ${PORT}`);
});

export { io, logger };
