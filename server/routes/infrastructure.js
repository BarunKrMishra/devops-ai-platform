import express from 'express';
import { EC2Client, DescribeInstancesCommand, RunInstancesCommand } from '@aws-sdk/client-ec2';
import { RDSClient, DescribeDBInstancesCommand } from '@aws-sdk/client-rds';
import { db } from '../database/init.js';
import { logAuditAction } from '../utils/audit.js';
import { decryptPayload } from '../utils/encryption.js';

const router = express.Router();

const parseConfig = (value) => {
  if (!value) {
    return {};
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    return {};
  }
};

const loadAwsIntegration = (organizationId) => {
  const row = db.prepare(`
    SELECT i.configuration, s.encrypted_payload
    FROM integrations i
    JOIN integration_secrets s ON s.integration_id = i.id
    WHERE i.organization_id = ? AND i.type = 'aws' AND i.is_active = 1
    LIMIT 1
  `).get(organizationId);

  if (!row) {
    return null;
  }

  const configuration = parseConfig(row.configuration);
  const metadata = configuration.metadata || {};
  let credentials;

  try {
    const payload = JSON.parse(row.encrypted_payload);
    credentials = decryptPayload(payload);
  } catch (error) {
    console.error('Failed to decrypt AWS integration payload:', error);
    return null;
  }

  if (!credentials?.access_key_id || !credentials?.secret_access_key) {
    return null;
  }

  return {
    region: metadata.region || process.env.AWS_REGION || 'us-east-1',
    accessKeyId: credentials.access_key_id,
    secretAccessKey: credentials.secret_access_key,
    sessionToken: credentials.session_token || null
  };
};

const buildAwsClients = (awsConfig) => {
  const credentials = {
    accessKeyId: awsConfig.accessKeyId,
    secretAccessKey: awsConfig.secretAccessKey
  };
  if (awsConfig.sessionToken) {
    credentials.sessionToken = awsConfig.sessionToken;
  }

  return {
    ec2Client: new EC2Client({ region: awsConfig.region, credentials }),
    rdsClient: new RDSClient({ region: awsConfig.region, credentials })
  };
};

// Get infrastructure overview with dynamic data
router.get('/overview', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const awsIntegration = loadAwsIntegration(organizationId);

    if (!awsIntegration) {
      const demoOverview = {
        data_source: 'demo',
        requires_integration: true,
        totalInstances: Math.floor(3 + Math.random() * 8),
        totalDatabases: Math.floor(1 + Math.random() * 4),
        monthlyCost: Math.floor(400 + Math.random() * 600),
        lastUpdated: new Date().toISOString()
      };

      return res.json(demoOverview);
    }

    const { ec2Client, rdsClient } = buildAwsClients(awsIntegration);
    const [instancesResponse, rdsResponse] = await Promise.all([
      ec2Client.send(new DescribeInstancesCommand({})),
      rdsClient.send(new DescribeDBInstancesCommand({}))
    ]);

    const totalInstances = (instancesResponse.Reservations || []).reduce((sum, reservation) => {
      return sum + (reservation.Instances?.length || 0);
    }, 0);

    const totalDatabases = (rdsResponse.DBInstances || []).length;
    const monthlyCost = totalInstances * 25 + totalDatabases * 40;

    res.json({
      data_source: 'aws',
      requires_integration: false,
      region: awsIntegration.region,
      totalInstances,
      totalDatabases,
      monthlyCost,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Infrastructure overview error:', error);
    res.status(502).json({ error: 'Failed to fetch infrastructure overview. Check AWS credentials or region.' });
  }
});

// Get detailed infrastructure resources
router.get('/resources', async (req, res) => {
  try {
    const userId = req.user.id;

    // Generate realistic infrastructure resources
    const resourceTypes = [
      { type: 'ec2', name: 'EC2 Instance', provider: 'aws' },
      { type: 'rds', name: 'RDS Database', provider: 'aws' },
      { type: 's3', name: 'S3 Bucket', provider: 'aws' },
      { type: 'lambda', name: 'Lambda Function', provider: 'aws' },
      { type: 'vpc', name: 'VPC', provider: 'aws' },
      { type: 'alb', name: 'Application Load Balancer', provider: 'aws' }
    ];
    
    const regions = [
      { name: 'US East (N. Virginia)', code: 'us-east-1' },
      { name: 'US West (Oregon)', code: 'us-west-2' },
      { name: 'EU West (Ireland)', code: 'eu-west-1' },
      { name: 'Asia Pacific (Singapore)', code: 'ap-southeast-1' }
    ];
    
    const resources = [];
    
    // Generate 15-25 resources
    const numResources = Math.floor(15 + Math.random() * 10);
    
    for (let i = 0; i < numResources; i++) {
      const resourceType = resourceTypes[Math.floor(Math.random() * resourceTypes.length)];
      const region = regions[Math.floor(Math.random() * regions.length)];
      const isActive = Math.random() > 0.1; // 90% active
      
      const resource = {
        id: i + 1,
        name: `${resourceType.name}-${Math.floor(Math.random() * 1000)}`,
        type: resourceType.type,
        provider: resourceType.provider,
        region: region.code,
        regionName: region.name,
        status: isActive ? (Math.random() > 0.15 ? 'running' : 'stopped') : 'terminated',
        cost: Math.floor(10 + Math.random() * 200),
        created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        last_updated: new Date().toISOString(),
        tags: generateRandomTags(),
        configuration: generateResourceConfig(resourceType.type)
      };
      
      resources.push(resource);
    }
    
    res.json(resources);
  } catch (error) {
    console.error('Resources fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
});

// Provision new resource
router.post('/provision', async (req, res) => {
  try {
    const { projectId, resourceType, configuration } = req.body;
    const userId = req.user.id;

    // Validate project ownership
    const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(projectId, userId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Simulate provisioning process
    const provisioningTime = Math.floor(Math.random() * 30000) + 15000; // 15-45 seconds
    
    setTimeout(() => {
      // In a real implementation, this would create the actual resource
      console.log(`Resource ${resourceType} provisioned for project ${projectId}`);
    }, provisioningTime);
    
    res.json({
      success: true,
      message: 'Resource provisioning initiated',
      resourceId: Math.floor(Math.random() * 10000),
      estimatedTime: `${Math.ceil(provisioningTime / 1000)} seconds`,
      status: 'provisioning'
    });
  } catch (error) {
    console.error('Provisioning error:', error);
    res.status(500).json({ error: 'Failed to provision resource' });
  }
});

// Get cost analysis
router.get('/costs', async (req, res) => {
  try {
    const userId = req.user.id;

    // Generate realistic cost data for the last 6 months
    const costData = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = month.toLocaleString('default', { month: 'short' });
      
      // Generate realistic cost patterns
      const baseCost = 800 + Math.random() * 400;
      const seasonalMultiplier = month.getMonth() >= 11 || month.getMonth() <= 1 ? 1.2 : 1.0; // Higher in winter
      
      costData.push({
        month: monthName,
        total: Math.floor(baseCost * seasonalMultiplier),
        compute: Math.floor(baseCost * 0.4 * seasonalMultiplier),
        storage: Math.floor(baseCost * 0.25 * seasonalMultiplier),
        database: Math.floor(baseCost * 0.2 * seasonalMultiplier),
        network: Math.floor(baseCost * 0.15 * seasonalMultiplier)
      });
    }
    
    // Generate cost optimization recommendations
    const recommendations = [
      {
        type: 'reserved_instances',
        title: 'Switch to Reserved Instances',
        description: 'Save 40% on compute costs with reserved instances',
        potentialSavings: Math.floor(200 + Math.random() * 300),
        effort: 'low'
      },
      {
        type: 'storage_optimization',
        title: 'Optimize Storage Classes',
        description: 'Move infrequently accessed data to cheaper storage',
        potentialSavings: Math.floor(50 + Math.random() * 100),
        effort: 'medium'
      },
      {
        type: 'auto_scaling',
        title: 'Implement Auto-scaling',
        description: 'Scale down during off-peak hours',
        potentialSavings: Math.floor(100 + Math.random() * 200),
        effort: 'high'
      }
    ];
    
    res.json({
      costData,
      recommendations,
      totalSpent: costData.reduce((sum, month) => sum + month.total, 0),
      averageMonthly: Math.floor(costData.reduce((sum, month) => sum + month.total, 0) / 6)
    });
  } catch (error) {
    console.error('Cost analysis error:', error);
    res.status(500).json({ error: 'Failed to fetch cost data' });
  }
});

// Helper functions
function generateRandomTags() {
  const tagOptions = ['production', 'staging', 'development', 'frontend', 'backend', 'database', 'monitoring'];
  const numTags = Math.floor(Math.random() * 3) + 1;
  const tags = [];
  
  for (let i = 0; i < numTags; i++) {
    const tag = tagOptions[Math.floor(Math.random() * tagOptions.length)];
    if (!tags.includes(tag)) {
      tags.push(tag);
    }
  }
  
  return tags;
}

function generateResourceConfig(type) {
  const configs = {
    ec2: {
      instanceType: 't3.medium',
      vcpu: 2,
      memory: '4 GB',
      storage: '20 GB'
    },
    rds: {
      engine: 'postgresql',
      version: '13.7',
      instanceClass: 'db.t3.micro',
      storage: '20 GB'
    },
    s3: {
      storageClass: 'STANDARD',
      versioning: 'Enabled',
      encryption: 'AES256'
    },
    lambda: {
      runtime: 'nodejs18.x',
      timeout: 30,
      memory: 128
    },
    vpc: {
      cidr: '10.0.0.0/16',
      subnets: 3,
      natGateway: true
    },
    alb: {
      scheme: 'internet-facing',
      type: 'application',
      targetGroups: 2
    }
  };
  
  return configs[type] || {};
}

export default router;
