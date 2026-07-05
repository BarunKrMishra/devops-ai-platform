import express from 'express';
import { sequelize } from '../database/sequelize.js';
import os from 'os';

const router = express.Router();

// Health check endpoint
router.get('/', async (req, res) => {
  try {
    const dbCheck = await sequelize.authenticate()
      .then(() => true)
      .catch(() => false);

    // System health metrics
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
        usage: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2) + '%'
      },
      cpu: {
        cores: os.cpus().length,
        load: os.loadavg()
      },
      database: dbCheck ? 'connected' : 'disconnected',
      version: process.env.npm_package_version || '1.0.0'
    };

    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Detailed health metrics (protected route)
router.get('/metrics', async (req, res) => {
  try {
    const metrics = {
      system: {
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        uptime: os.uptime(),
        loadavg: os.loadavg(),
        totalmem: os.totalmem(),
        freemem: os.freemem(),
        cpus: os.cpus(),
        networkInterfaces: os.networkInterfaces()
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        version: process.version,
        versions: process.versions,
        env: {
          NODE_ENV: process.env.NODE_ENV
        }
      },
      database: {
        connected: await sequelize.authenticate().then(() => true).catch(() => false),
        host: process.env.MYSQL_HOST || 'via MYSQL_URL'
      }
    };

    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router; 
