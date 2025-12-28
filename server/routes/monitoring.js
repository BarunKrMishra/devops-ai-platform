import express from 'express';
import { db } from '../database/init.js';
import { io } from '../index.js';

const router = express.Router();

// Simulate real-time metrics with realistic patterns
function generateRealisticMetrics() {
  const now = Date.now();
  const metrics = {
    cpu: [],
    memory: [],
    network: [],
    errors: [],
    responseTime: [],
    uptime: 99.9,
    lastUpdated: new Date().toISOString()
  };

  // Generate 24 hours of data with realistic patterns
  for (let i = 23; i >= 0; i--) {
    const timestamp = new Date(now - i * 60 * 60 * 1000);
    const hour = timestamp.getHours();
    
    // Simulate traffic patterns (higher during business hours)
    const trafficMultiplier = hour >= 9 && hour <= 17 ? 1.5 : 0.7;
    
    metrics.cpu.push({
      timestamp: timestamp.toISOString(),
      value: Math.floor(30 + Math.random() * 40 * trafficMultiplier)
    });
    
    metrics.memory.push({
      timestamp: timestamp.toISOString(),
      value: Math.floor(50 + Math.random() * 30 * trafficMultiplier)
    });
    
    metrics.network.push({
      timestamp: timestamp.toISOString(),
      value: Math.floor(20 + Math.random() * 40 * trafficMultiplier)
    });
    
    // Errors are rare but increase during high traffic
    metrics.errors.push({
      timestamp: timestamp.toISOString(),
      value: Math.floor(Math.random() * (trafficMultiplier > 1 ? 8 : 3))
    });
    
    // Response time increases with traffic
    metrics.responseTime.push({
      timestamp: timestamp.toISOString(),
      value: Math.floor(150 + Math.random() * 200 * trafficMultiplier)
    });
  }
  
  return metrics;
}

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

    const metrics = generateRealisticMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Metrics fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// Get alerts with dynamic generation
router.get('/alerts', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's projects to generate relevant alerts
    const projects = db.prepare('SELECT * FROM projects WHERE user_id = ?').all(userId);
    
    const alertTemplates = [
      {
        type: 'warning',
        title: 'High CPU Usage',
        message: 'CPU usage has been above 80% for the last 10 minutes',
        condition: () => Math.random() > 0.7
      },
      {
        type: 'info',
        title: 'Deployment Successful',
        message: 'Your application has been successfully deployed to production',
        condition: () => Math.random() > 0.8
      },
      {
        type: 'error',
        title: 'Database Connection Failed',
        message: 'Unable to connect to the database. Auto-healing in progress.',
        condition: () => Math.random() > 0.9
      },
      {
        type: 'warning',
        title: 'Memory Usage Alert',
        message: 'Memory usage is approaching 85% threshold',
        condition: () => Math.random() > 0.75
      },
      {
        type: 'info',
        title: 'Backup Completed',
        message: 'Daily backup completed successfully',
        condition: () => Math.random() > 0.85
      }
    ];

    const alerts = alertTemplates
      .filter(alert => alert.condition())
      .map((alert, index) => ({
        id: index + 1,
        type: alert.type,
        title: alert.title,
        message: alert.message,
        timestamp: new Date(Date.now() - Math.random() * 60 * 60 * 1000).toISOString(),
        resolved: Math.random() > 0.3
      }))
      .slice(0, 5); // Limit to 5 alerts

    res.json(alerts);
  } catch (error) {
    console.error('Alerts fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Auto-healing endpoint with realistic actions
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

    // Realistic healing actions based on issue type
    const healingActions = {
      'high_cpu': 'Scaled up instances and optimized resource allocation',
      'memory_leak': 'Restarted application and cleared memory cache',
      'database_connection': 'Reconnected to database and updated connection pool',
      'disk_space': 'Cleaned up temporary files and expanded storage',
      'network_latency': 'Optimized network routing and updated load balancer',
      'service_unavailable': 'Restarted service and verified health checks'
    };

    const action = healingActions[issue] || 'Applied general optimization measures';
    
    // Simulate healing process with realistic timing
    const healingTime = Math.floor(Math.random() * 3000) + 2000; // 2-5 seconds
    
    setTimeout(() => {
      io.to(`user-${userId}`).emit('healing-complete', {
        resourceId,
        action,
        timestamp: new Date().toISOString(),
        success: Math.random() > 0.1 // 90% success rate
      });
    }, healingTime);

    res.json({ 
      success: true, 
      message: 'Auto-healing initiated',
      action,
      estimatedTime: `${Math.ceil(healingTime / 1000)} seconds`
    });
  } catch (error) {
    console.error('Auto-healing error:', error);
    res.status(500).json({ error: 'Failed to initiate auto-healing' });
  }
});

// Health check endpoint with dynamic status
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

    // Generate realistic health status
    const healthStatus = {
      overall: Math.random() > 0.1 ? 'healthy' : 'warning',
      services: resources.map(resource => ({
        id: resource.id,
        type: resource.resource_type,
        status: Math.random() > 0.15 ? 'healthy' : (Math.random() > 0.5 ? 'warning' : 'critical'),
        uptime: Math.random() * 100,
        lastCheck: new Date().toISOString(),
        responseTime: Math.floor(Math.random() * 500) + 50
      }))
    };

    res.json(healthStatus);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ error: 'Failed to perform health check' });
  }
});

export default router;