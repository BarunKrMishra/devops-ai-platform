import './config/env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import winston from 'winston';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import axios from 'axios';
import { isBlockedRequestUrl } from './utils/ssrf.js';

// Global SSRF guard: reject any outbound HTTP request to a cloud-metadata host.
axios.interceptors.request.use((config) => {
  const target = config.url && /^https?:\/\//i.test(config.url)
    ? config.url
    : `${config.baseURL || ''}${config.url || ''}`;
  if (target && isBlockedRequestUrl(target)) {
    return Promise.reject(new Error('Blocked outbound request to a metadata endpoint.'));
  }
  return config;
});
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
import businessRoutes from './routes/business.js';
import opsRoutes from './routes/ops.js';
import billingRoutes from './routes/billing.js';
import contentRoutes from './routes/content.js';
import trackRoutes from './routes/track.js';
import platformRoutes from './routes/platform.js';
import { authenticateToken } from './middleware/auth.js';
import { requirePlatformAdmin } from './middleware/platform.js';
import { Project } from './models/index.js';
import { initializeDatabase } from './database/index.js';
import { startUsageMetricsJob } from './jobs/usageMetrics.js';
import { startIntegrationSyncJob } from './jobs/integrationSync.js';
import { withRequestContext } from './utils/requestContext.js';

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

// Allow Netlify preview/production subdomains in production. The cors package
// only wildcard-matches via RegExp (a literal "*.netlify.app" string never
// matches a real Origin header), so use anchored regexes.
const netlifyOriginPatterns = [/\.netlify\.app$/, /\.netlify\.com$/];

if (NODE_ENV === 'production' && !CORS_ORIGIN.some(origin => typeof origin === 'string' && origin.includes('netlify'))) {
  CORS_ORIGIN = [...CORS_ORIGIN, ...netlifyOriginPatterns];
}

console.log('CORS Origins configured:', CORS_ORIGIN);

const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX) || (NODE_ENV === 'production' ? 100 : 1000);
const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED !== 'false';

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
// Gzip responses for smaller payloads / faster loads.
app.use(compression());
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
  message: 'Too many requests from this IP, please try again later.',
  skip: () => !RATE_LIMIT_ENABLED || NODE_ENV !== 'production'
});
app.use('/api/', limiter);

// Dedicated throttle for authentication endpoints. Always on (independent of
// NODE_ENV) to blunt password / OTP brute-force attempts. Generous enough for
// legitimate register->verify and login->verify flows.
const AUTH_RATE_LIMIT_ENABLED = process.env.AUTH_RATE_LIMIT_ENABLED !== 'false';
const AUTH_RATE_LIMIT_MAX = Number(process.env.AUTH_RATE_LIMIT_MAX) || 30;
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: AUTH_RATE_LIMIT_MAX,
  message: 'Too many authentication attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !AUTH_RATE_LIMIT_ENABLED
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/request-password-reset', authLimiter);
app.use('/api/auth/verify-otp', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/auth/verify-2fa', authLimiter);

// Body parsing middleware with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request context middleware for audit logging
app.use(withRequestContext);

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
await initializeDatabase();
startUsageMetricsJob();
startIntegrationSyncJob();

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
    const user = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

// Routes
// Health check route (no authentication required)
app.use('/api/health', healthRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/track', trackRoutes);
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
app.use('/api/business', authenticateToken, businessRoutes);
app.use('/api/ops', authenticateToken, opsRoutes);
app.use('/api/billing', authenticateToken, billingRoutes);

// Aikya team super-admin console — cross-organization, gated to platform admins.
app.use('/api/platform', authenticateToken, requirePlatformAdmin, platformRoutes);

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

  socket.on('join-project', async (projectId) => {
    // Only allow joining a project room if the project belongs to the
    // authenticated user's organization (prevents cross-tenant snooping).
    try {
      const project = await Project.findOne({
        where: { id: projectId, organization_id: socket.user.organization_id },
        attributes: ['id']
      });
      if (project) {
        socket.join(`project-${projectId}`);
      } else {
        socket.emit('error', 'Access denied to project');
      }
    } catch (error) {
      logger.error('join-project verification failed:', error);
      socket.emit('error', 'Unable to join project');
    }
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
