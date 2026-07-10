import express from 'express';
import { AiInteraction, Project, Deployment, InfrastructureResource } from '../models/index.js';
import { aiService } from '../services/aiService.js';
import { logAuditAction } from '../utils/audit.js';

const router = express.Router();

const extractJson = (text) => {
  if (!text || typeof text !== 'string') {
    return null;
  }
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const start = trimmed.indexOf('[');
    const end = trimmed.lastIndexOf(']');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch (innerError) {
        return null;
      }
    }
  }
  return null;
};

// When no AI provider is connected we never fabricate analysis. We return an
// honest signal so the UI can prompt the customer to bring their own AI.
const AI_NOT_CONNECTED =
  "AI isn't connected yet. Bring your own AI provider (OpenAI or Anthropic) to unlock "
  + 'real-time analysis, cost optimization and assistant replies — you get faster, tailored '
  + 'output on your own model. Native Aikya AI is coming shortly.';

// Process AI command
router.post('/command', async (req, res) => {
  try {
    const { command } = req.body;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    const interaction = await AiInteraction.create({
      user_id: userId,
      organization_id: organizationId,
      command
    });

    const response = await processAICommand(command, userId);

    await AiInteraction.update(
      { response: response.message, action_taken: response.action, success: response.success },
      { where: { id: interaction.id } }
    );

    if (response.action && response.action !== 'none') {
      await logAuditAction(userId, 'AI_COMMAND', 'ai_interaction', interaction.id, {
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
    const organizationId = req.user.organization_id;

    const project = await Project.findOne({ where: { id: projectId, organization_id: organizationId }, raw: true });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const resources = await InfrastructureResource.findAll({ where: { project_id: projectId }, raw: true });
    const deployments = await Deployment.findAll({
      where: { project_id: projectId },
      order: [['created_at', 'DESC']],
      limit: 10,
      raw: true
    });

    const suggestions = generateAISuggestions(resources, deployments);

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
    const organizationId = req.user.organization_id;

    const project = await Project.findOne({ where: { id: projectId, organization_id: organizationId }, raw: true });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const resources = await InfrastructureResource.findAll({ where: { project_id: projectId }, raw: true });

    const recommendations = generateCostOptimizationRecommendations(resources);

    res.json(recommendations);
  } catch (error) {
    console.error('Cost optimization error:', error);
    res.status(500).json({ error: 'Failed to generate cost optimization recommendations' });
  }
});

// Predictive analysis — real AI only. No fabricated predictions.
router.get('/predictions', async (_req, res) => {
  try {
    if (!aiService.isEnabled()) {
      return res.json({ ai_enabled: false, predictions: [], message: AI_NOT_CONNECTED });
    }
    const aiResponse = await aiService.complete(
      'Generate a JSON array of 3 operational predictions for a DevOps dashboard. '
      + 'Each item must include: id, type, title, description, confidence, impact, timeframe, recommendation, probability.'
    );
    const parsed = extractJson(aiResponse);
    return res.json({ ai_enabled: true, predictions: Array.isArray(parsed) ? parsed : [] });
  } catch (error) {
    console.error('Predictions error:', error);
    res.status(500).json({ error: 'Failed to generate predictions' });
  }
});

// AI recommendations — real AI only.
router.get('/recommendations', async (_req, res) => {
  try {
    if (!aiService.isEnabled()) {
      return res.json({ ai_enabled: false, recommendations: [], message: AI_NOT_CONNECTED });
    }
    const aiResponse = await aiService.complete(
      'Generate a JSON array of 4 AI recommendations for DevOps and business ops. '
      + 'Each item must include: id, category, title, description, impact, effort, estimatedSavings, priority, tags.'
    );
    const parsed = extractJson(aiResponse);
    return res.json({ ai_enabled: true, recommendations: Array.isArray(parsed) ? parsed : [] });
  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

// AI assistant chat — real AI only, honest otherwise.
router.post('/chat', async (req, res) => {
  try {
    const { message, context } = req.body;
    if (!aiService.isEnabled() || !message) {
      return res.json({ ai_enabled: false, response: AI_NOT_CONNECTED, timestamp: new Date().toISOString() });
    }
    const aiResponse = await aiService.complete(
      `Context: ${JSON.stringify(context || {})}\nUser: ${message}\nProvide a concise helpful reply.`
    );
    return res.json({ ai_enabled: true, response: aiResponse || AI_NOT_CONNECTED, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

async function processAICommand(command) {
  // Real AI output, or an honest bring-your-own-AI prompt — never fabricated.
  if (!aiService.isEnabled()) {
    return { message: AI_NOT_CONNECTED, action: 'none', success: false, ai_enabled: false };
  }
  try {
    const aiResponse = await aiService.complete(
      `You are Aikya's operations copilot. User command: ${command}\n`
      + 'Give a concise, actionable answer grounded in DevOps/business-ops best practice.'
    );
    if (!aiResponse) {
      return { message: AI_NOT_CONNECTED, action: 'none', success: false, ai_enabled: false };
    }
    return { message: aiResponse, action: 'ai_response', success: true, ai_enabled: true };
  } catch (error) {
    console.error('AI provider error:', error);
    return { message: 'The AI provider returned an error. Please check your AI configuration and try again.', action: 'none', success: false, ai_enabled: true };
  }
}

function generateAISuggestions(resources, deployments) {
  const suggestions = [];

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
      const savings = monthlyCost * 0.4;
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
      const savings = monthlyCost * 0.25;
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
