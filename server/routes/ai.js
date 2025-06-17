import express from 'express';
import OpenAI from 'openai';
import { db } from '../database/init.js';
import { logAuditAction } from '../utils/audit.js';

const router = express.Router();

// Initialize OpenAI (in production, use proper API key)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'demo-key'
});

// Process AI command
router.post('/command', async (req, res) => {
  try {
    const { command } = req.body;
    const userId = req.user.id;

    // Log the interaction
    const interaction = await db.query(
      'INSERT INTO ai_interactions (user_id, command) VALUES ($1, $2) RETURNING id',
      [userId, command]
    );

    const interactionId = interaction.rows[0].id;

    // Process command with AI
    const response = await processAICommand(command, userId);

    // Update interaction with response
    await db.query(
      'UPDATE ai_interactions SET response = $1, action_taken = $2, success = $3 WHERE id = $4',
      [response.message, response.action, response.success, interactionId]
    );

    // Log audit action if an action was taken
    if (response.action && response.action !== 'none') {
      await logAuditAction(userId, 'AI_COMMAND', 'ai_interaction', interactionId, {
        command,
        action: response.action
      });
    }

    res.json(response);
  } catch (error) {
    console.error('AI command error:', error);
    res.status(500).json({ error: 'Failed to process AI command' });
  }
});

// Get AI suggestions
router.get('/suggestions/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    // Verify project ownership
    const project = await db.query('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [projectId, userId]);
    if (project.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get project resources and metrics
    const resources = await db.query(
      'SELECT * FROM infrastructure_resources WHERE project_id = $1',
      [projectId]
    );

    const deployments = await db.query(
      'SELECT * FROM deployments WHERE project_id = $1 ORDER BY created_at DESC LIMIT 10',
      [projectId]
    );

    // Generate AI suggestions based on data
    const suggestions = generateAISuggestions(resources.rows, deployments.rows);

    res.json(suggestions);
  } catch (error) {
    console.error('AI suggestions error:', error);
    res.status(500).json({ error: 'Failed to generate AI suggestions' });
  }
});

// Get cost optimization recommendations
router.get('/cost-optimization/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    // Verify project ownership
    const project = await db.query('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [projectId, userId]);
    if (project.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get project resources
    const resources = await db.query(
      'SELECT * FROM infrastructure_resources WHERE project_id = $1',
      [projectId]
    );

    const recommendations = generateCostOptimizationRecommendations(resources.rows);

    res.json(recommendations);
  } catch (error) {
    console.error('Cost optimization error:', error);
    res.status(500).json({ error: 'Failed to generate cost optimization recommendations' });
  }
});

async function processAICommand(command, userId) {
  const lowerCommand = command.toLowerCase();

  // Simple command processing (in production, use proper NLP)
  if (lowerCommand.includes('deploy')) {
    return {
      message: "I'll help you deploy your application. I can see you have projects ready. Would you like me to:\n\n• Deploy to AWS with auto-scaling\n• Set up CI/CD pipeline with GitHub Actions\n• Configure load balancing and SSL\n\nWhich project would you like to deploy?",
      action: 'suggest_deployment',
      success: true
    };
  } else if (lowerCommand.includes('scale')) {
    return {
      message: "I can help optimize your scaling strategy. Based on your current traffic patterns, I recommend:\n\n• Enable auto-scaling for your instances\n• Set up monitoring alerts for CPU > 70%\n• Configure scale-down during low traffic hours\n\nThis could save you approximately 30% on compute costs.",
      action: 'suggest_scaling',
      success: true
    };
  } else if (lowerCommand.includes('cost') || lowerCommand.includes('optimize')) {
    return {
      message: "I've analyzed your infrastructure costs. Here are my recommendations:\n\n• Switch to Reserved Instances (save $234/month)\n• Right-size your databases (save $89/month)\n• Enable automated shutdown for dev environments (save $156/month)\n\nTotal potential savings: $479/month. Should I implement these optimizations?",
      action: 'suggest_cost_optimization',
      success: true
    };
  } else if (lowerCommand.includes('monitor') || lowerCommand.includes('alert')) {
    return {
      message: "I'll set up comprehensive monitoring for your applications:\n\n• CPU and memory usage alerts\n• Error rate monitoring\n• Response time tracking\n• Automated incident response\n\nWould you like me to configure these monitoring rules now?",
      action: 'suggest_monitoring',
      success: true
    };
  } else {
    return {
      message: "I understand you're looking for help with your DevOps workflow. I can assist with:\n\n• Application deployment and scaling\n• Infrastructure provisioning\n• Cost optimization\n• CI/CD pipeline setup\n• Monitoring and alerting\n\nCould you tell me more about what you'd like to achieve?",
      action: 'none',
      success: true
    };
  }
}

function generateAISuggestions(resources, deployments) {
  const suggestions = [];

  // Analyze deployment frequency
  if (deployments.length > 0) {
    const recentFailures = deployments.filter(d => d.status === 'failed').length;
    if (recentFailures > 2) {
      suggestions.push({
        type: 'warning',
        title: 'High Deployment Failure Rate',
        description: 'Consider implementing more comprehensive testing before deployment',
        priority: 'high',
        action: 'setup_testing'
      });
    }
  }

  // Analyze resource utilization
  resources.forEach(resource => {
    if (resource.resource_type === 'ec2') {
      suggestions.push({
        type: 'optimization',
        title: 'Auto-scaling Recommendation',
        description: `Consider enabling auto-scaling for ${resource.resource_id} to handle traffic spikes`,
        priority: 'medium',
        action: 'enable_autoscaling'
      });
    }
  });

  // Cost optimization
  const totalMonthlyCost = resources.reduce((sum, r) => sum + (parseFloat(r.cost_per_hour) * 24 * 30), 0);
  if (totalMonthlyCost > 500) {
    suggestions.push({
      type: 'cost',
      title: 'Cost Optimization Opportunity',
      description: 'Your monthly costs could be reduced by 25% with reserved instances',
      priority: 'medium',
      action: 'optimize_costs'
    });
  }

  return suggestions;
}

function generateCostOptimizationRecommendations(resources) {
  const recommendations = [];
  let totalSavings = 0;

  resources.forEach(resource => {
    const monthlyCost = parseFloat(resource.cost_per_hour) * 24 * 30;
    
    if (resource.resource_type === 'ec2' && monthlyCost > 50) {
      const savings = monthlyCost * 0.4; // 40% savings with reserved instances
      totalSavings += savings;
      
      recommendations.push({
        type: 'reserved_instances',
        title: 'Switch to Reserved Instances',
        description: `Convert ${resource.resource_id} to reserved instance`,
        currentCost: monthlyCost,
        potentialSavings: savings,
        effort: 'low',
        timeframe: 'immediate'
      });
    }

    if (resource.resource_type === 'rds' && monthlyCost > 30) {
      const savings = monthlyCost * 0.25; // 25% savings with right-sizing
      totalSavings += savings;
      
      recommendations.push({
        type: 'rightsizing',
        title: 'Right-size Database Instance',
        description: `Optimize ${resource.resource_id} instance size`,
        currentCost: monthlyCost,
        potentialSavings: savings,
        effort: 'medium',
        timeframe: '1-2 days'
      });
    }
  });

  return {
    totalPotentialSavings: totalSavings,
    recommendations
  };
}

export default router;