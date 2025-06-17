import express from 'express';
import { db } from '../database/init.js';
import { io } from '../index.js';

const router = express.Router();

// Get monitoring data
router.get('/metrics/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    // Verify project ownership
    const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(projectId, userId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Generate mock metrics data
    const metrics = {
      cpu: generateMetricData(30, 70),
      memory: generateMetricData(40, 80),
      network: generateMetricData(10, 50),
      errors: generateMetricData(0, 5),
      responseTime: generateMetricData(100, 500),
      uptime: 99.9,
      lastUpdated: new Date().toISOString()
    };

    res.json(metrics);
  } catch (error) {
    console.error('Metrics fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// Get alerts
router.get('/alerts', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Generate mock alerts
    const alerts = [
      {
        id: 1,
        type: 'warning',
        title: 'High CPU Usage',
        message: 'CPU usage has been above 80% for the last 10 minutes',
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        resolved: false
      },
      {
        id: 2,
        type: 'info',
        title: 'Deployment Successful',
        message: 'Your application has been successfully deployed to production',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        resolved: true
      },
      {
        id: 3,
        type: 'error',
        title: 'Database Connection Failed',
        message: 'Unable to connect to the database. Auto-healing in progress.',
        timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        resolved: true
      }
    ];

    res.json(alerts);
  } catch (error) {
    console.error('Alerts fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Auto-healing endpoint
router.post('/auto-heal/:resourceId', async (req, res) => {
  try {
    const { resourceId } = req.params;
    const { issue } = req.body;
    const userId = req.user.id;

    // Get resource
    const resource = db.prepare(
      `SELECT ir.*, p.user_id FROM infrastructure_resources ir 
       JOIN projects p ON ir.project_id = p.id WHERE ir.id = ?`
    ).get(resourceId);

    if (!resource || resource.user_id !== userId) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    // Simulate auto-healing actions
    const healingActions = {
      'high_cpu': 'Scaled up instances and optimized resource allocation',
      'memory_leak': 'Restarted application and cleared memory cache',
      'database_connection': 'Reconnected to database and updated connection db',
      'disk_space': 'Cleaned up temporary files and expanded storage'
    };

    const action = healingActions[issue] || 'Applied general optimization measures';
    
    // Simulate healing process
    setTimeout(() => {
      io.to(`user-${userId}`).emit('healing-complete', {
        resourceId,
        action,
        timestamp: new Date().toISOString()
      });
    }, 3000);

    res.json({ 
      success: true, 
      message: 'Auto-healing initiated',
      action,
      estimatedTime: '2-3 minutes'
    });
  } catch (error) {
    console.error('Auto-healing error:', error);
    res.status(500).json({ error: 'Failed to initiate auto-healing' });
  }
});

// Health check endpoint
router.get('/health/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    // Verify project ownership
    const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(projectId, userId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get project resources
    const resources = db.prepare(
      'SELECT * FROM infrastructure_resources WHERE project_id = ?'
    ).all(projectId);

    const healthStatus = {
      overall: 'healthy',
      services: resources.map(resource => ({
        id: resource.id,
        type: resource.resource_type,
        status: Math.random() > 0.1 ? 'healthy' : 'warning',
        uptime: Math.random() * 100,
        lastCheck: new Date().toISOString()
      }))
    };

    res.json(healthStatus);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ error: 'Failed to perform health check' });
  }
});

function generateMetricData(min, max) {
  const data = [];
  const now = Date.now();
  
  for (let i = 23; i >= 0; i--) {
    data.push({
      timestamp: new Date(now - i * 60 * 60 * 1000).toISOString(),
      value: Math.floor(Math.random() * (max - min) + min)
    });
  }
  
  return data;
}

export default router;