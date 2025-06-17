import express from 'express';
import { EC2Client, DescribeInstancesCommand, RunInstancesCommand } from '@aws-sdk/client-ec2';
import { RDSClient, DescribeDBInstancesCommand } from '@aws-sdk/client-rds';
import { db } from '../database/init.js';
import { logAuditAction } from '../utils/audit.js';

const router = express.Router();

// Initialize AWS clients (in production, use proper credentials)
const ec2Client = new EC2Client({ 
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'demo',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'demo'
  }
});

// Get infrastructure overview
router.get('/overview', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's infrastructure resources
    const resources = db.prepare(
      `SELECT ir.*, p.user_id FROM infrastructure_resources ir 
       JOIN projects p ON ir.project_id = p.id WHERE p.user_id = ?`
    ).all(userId);

    // Group by region and type
    const overview = {
      totalInstances: 0,
      totalDatabases: 0,
      regions: {},
      monthlyCost: 0
    };

    resources.forEach(resource => {
      if (resource.resource_type === 'ec2') overview.totalInstances++;
      if (resource.resource_type === 'rds') overview.totalDatabases++;
      
      if (!overview.regions[resource.region]) {
        overview.regions[resource.region] = {
          name: resource.region,
          services: []
        };
      }
      
      overview.monthlyCost += parseFloat(resource.cost_per_hour || 0) * 24 * 30;
    });

    res.json(overview);
  } catch (error) {
    console.error('Infrastructure overview error:', error);
    res.status(500).json({ error: 'Failed to fetch infrastructure overview' });
  }
});

// Provision new infrastructure
router.post('/provision', async (req, res) => {
  try {
    const { projectId, resourceType, configuration } = req.body;
    const userId = req.user.id;

    // Verify project ownership
    const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(projectId, userId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    let resourceId;
    let costPerHour = 0;

    // Simulate resource provisioning based on type
    switch (resourceType) {
      case 'ec2':
        resourceId = `i-${Math.random().toString(36).substr(2, 17)}`;
        costPerHour = configuration.instanceType === 't3.micro' ? 0.0104 : 0.0464;
        break;
      case 'rds':
        resourceId = `db-${Math.random().toString(36).substr(2, 17)}`;
        costPerHour = configuration.instanceClass === 'db.t3.micro' ? 0.017 : 0.068;
        break;
      case 's3':
        resourceId = `bucket-${Math.random().toString(36).substr(2, 17)}`;
        costPerHour = 0.001;
        break;
      default:
        return res.status(400).json({ error: 'Invalid resource type' });
    }

    // Save to database
    const insertStmt = db.prepare(
      `INSERT INTO infrastructure_resources 
        (project_id, resource_type, resource_id, region, status, configuration, cost_per_hour) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    insertStmt.run(
      projectId,
      resourceType,
      resourceId,
      configuration.region || 'us-east-1',
      'running',
      JSON.stringify(configuration),
      costPerHour
    );

    const resource = db.prepare(
      'SELECT * FROM infrastructure_resources WHERE resource_id = ?'
    ).get(resourceId);

    // Log audit action
    await logAuditAction(userId, 'PROVISION_RESOURCE', resourceType, resourceId, configuration);

    res.json(resource);
  } catch (error) {
    console.error('Infrastructure provisioning error:', error);
    res.status(500).json({ error: 'Failed to provision infrastructure' });
  }
});

// Get resource details
router.get('/resources/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    // Verify project ownership
    const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(projectId, userId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const resources = db.prepare(
      'SELECT * FROM infrastructure_resources WHERE project_id = ? ORDER BY created_at DESC'
    ).all(projectId);

    res.json(resources);
  } catch (error) {
    console.error('Resources fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
});

// Scale resource
router.post('/scale/:resourceId', async (req, res) => {
  try {
    const { resourceId } = req.params;
    const { action, targetCapacity } = req.body; // action: 'up' | 'down'
    const userId = req.user.id;

    // Get resource
    const resource = db.prepare(
      `SELECT ir.*, p.user_id FROM infrastructure_resources ir 
       JOIN projects p ON ir.project_id = p.id WHERE ir.id = ?`
    ).get(resourceId);

    if (!resource || resource.user_id !== userId) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    // Parse configuration if stored as JSON string
    let currentConfig = resource.configuration;
    if (typeof currentConfig === 'string') {
      try {
        currentConfig = JSON.parse(currentConfig);
      } catch {
        currentConfig = {};
      }
    }

    const newConfig = {
      ...currentConfig,
      scaledAt: new Date().toISOString(),
      previousCapacity: currentConfig.capacity || 1,
      capacity: targetCapacity
    };

    db.prepare(
      'UPDATE infrastructure_resources SET configuration = ? WHERE id = ?'
    ).run(JSON.stringify(newConfig), resourceId);

    // Log audit action
    await logAuditAction(userId, 'SCALE_RESOURCE', resource.resource_type, resource.resource_id, {
      action,
      targetCapacity,
      previousCapacity: currentConfig.capacity || 1
    });

    res.json({ success: true, message: `Resource scaled ${action} to ${targetCapacity}` });
  } catch (error) {
    console.error('Resource scaling error:', error);
    res.status(500).json({ error: 'Failed to scale resource' });
  }
});

export default router;