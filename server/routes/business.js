import express from 'express';
import { Op, fn, col } from 'sequelize';
import {
  BusinessAutomation,
  BusinessAutomationRun,
  BusinessLead,
  BusinessEmail
} from '../models/index.js';
import { executeWorkflow } from '../services/business/workflowEngine.js';
import { aiService } from '../services/aiService.js';
import { logAuditAction } from '../utils/audit.js';
import { getIntegrationRecord } from '../utils/integrations.js';
import { syncGmailInbox } from '../services/business/gmailSync.js';
import { syncImapInbox } from '../services/business/imapSync.js';
import { requireOpsAccess } from '../middleware/auth.js';
import { requireOpsEnabled } from '../middleware/ops.js';

const router = express.Router();
router.use(requireOpsAccess('businessops'), requireOpsEnabled('businessops'));

const normalizeLimit = (value, fallback) => {
  const limit = Number(value);
  if (Number.isFinite(limit)) {
    return Math.max(1, Math.min(200, limit));
  }
  return fallback;
};

router.get('/metrics', async (req, res) => {
  const orgId = req.user.organization_id;

  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const [emailsToday, leadsToday, activeAutomations, leadPipelineRows] = await Promise.all([
      BusinessEmail.count({
        where: {
          organization_id: orgId,
          processed_at: { [Op.gte]: startOfDay, [Op.lte]: endOfDay }
        }
      }),
      BusinessLead.count({
        where: {
          organization_id: orgId,
          created_at: { [Op.gte]: startOfDay, [Op.lte]: endOfDay }
        }
      }),
      BusinessAutomation.count({ where: { organization_id: orgId, status: 'active' } }),
      BusinessLead.findAll({
        where: { organization_id: orgId },
        attributes: ['status', [fn('COUNT', col('id')), 'count']],
        group: ['status'],
        raw: true
      })
    ]);

    const leadPipeline = leadPipelineRows.reduce((acc, row) => {
      acc[row.status] = Number(row.count);
      return acc;
    }, {});

    res.json({
      emails_today: emailsToday,
      new_leads: leadsToday,
      active_automations: activeAutomations,
      lead_pipeline: leadPipeline
    });
  } catch (error) {
    console.error('Business metrics error:', error);
    res.status(500).json({ error: 'Failed to load business metrics.' });
  }
});

router.get('/automations', async (req, res) => {
  const orgId = req.user.organization_id;
  const limit = normalizeLimit(req.query.limit, 50);

  try {
    const automations = await BusinessAutomation.findAll({
      where: { organization_id: orgId },
      order: [['created_at', 'DESC']],
      limit,
      raw: true
    });

    const enriched = await Promise.all(
      automations.map(async (automation) => {
        const lastRun = await BusinessAutomationRun.findOne({
          where: { automation_id: automation.id, organization_id: orgId },
          order: [['executed_at', 'DESC']],
          raw: true
        });

        return {
          ...automation,
          last_run_status: lastRun?.status || null,
          last_run_at: lastRun?.executed_at || null
        };
      })
    );

    res.json(enriched);
  } catch (error) {
    console.error('Fetch automations error:', error);
    res.status(500).json({ error: 'Failed to load automations.' });
  }
});

router.post('/automations', async (req, res) => {
  const orgId = req.user.organization_id;
  const userId = req.user.id;
  const { name, type, triggers = [], actions = [], config = {} } = req.body || {};

  if (!name || !type) {
    return res.status(400).json({ error: 'Automation name and type are required.' });
  }

  try {
    const automation = await BusinessAutomation.create({
      organization_id: orgId,
      created_by: userId,
      name,
      type,
      status: 'active',
      config: config || {},
      triggers: triggers || [],
      actions: actions || []
    });

    logAuditAction(userId, 'CREATE_BUSINESS_AUTOMATION', 'business_automation', automation.id, {
      name,
      type
    });

    res.status(201).json({
      id: automation.id,
      name,
      type,
      status: 'active',
      config,
      triggers,
      actions
    });
  } catch (error) {
    console.error('Create automation error:', error);
    res.status(500).json({ error: 'Failed to create automation.' });
  }
});

router.post('/automations/:id/execute', async (req, res) => {
  const orgId = req.user.organization_id;
  const userId = req.user.id;
  const automationId = req.params.id;
  const inputData = req.body || {};

  if (!automationId) {
    return res.status(400).json({ error: 'Invalid automation id.' });
  }

  const automation = await BusinessAutomation.findOne({ where: { id: automationId, organization_id: orgId }, raw: true });

  if (!automation) {
    return res.status(404).json({ error: 'Automation not found.' });
  }

  const startTime = Date.now();

  try {
    const result = await executeWorkflow({
      organizationId: orgId,
      userId,
      actions: automation.actions || [],
      config: automation.config || {},
      inputData
    });

    const duration = Date.now() - startTime;
    await BusinessAutomationRun.create({
      automation_id: automationId,
      organization_id: orgId,
      status: 'success',
      input_data: inputData,
      output_data: result,
      duration_ms: duration,
      executed_at: new Date()
    });

    logAuditAction(userId, 'EXECUTE_BUSINESS_AUTOMATION', 'business_automation', automationId, {
      status: 'success'
    });

    res.json({ status: 'success', result, duration_ms: duration });
  } catch (error) {
    const duration = Date.now() - startTime;
    await BusinessAutomationRun.create({
      automation_id: automationId,
      organization_id: orgId,
      status: 'failed',
      input_data: inputData,
      error_message: error.message || 'Execution failed',
      duration_ms: duration,
      executed_at: new Date()
    });

    logAuditAction(userId, 'EXECUTE_BUSINESS_AUTOMATION', 'business_automation', automationId, {
      status: 'failed',
      error: error.message || 'Execution failed'
    });

    res.status(500).json({ error: error.message || 'Automation execution failed.' });
  }
});

router.get('/automations/:id/runs', async (req, res) => {
  const orgId = req.user.organization_id;
  const automationId = req.params.id;
  const limit = normalizeLimit(req.query.limit, 50);

  if (!automationId) {
    return res.status(400).json({ error: 'Invalid automation id.' });
  }

  try {
    const runs = await BusinessAutomationRun.findAll({
      where: { automation_id: automationId, organization_id: orgId },
      order: [['executed_at', 'DESC']],
      limit,
      raw: true
    });

    res.json(runs);
  } catch (error) {
    console.error('Fetch automation runs error:', error);
    res.status(500).json({ error: 'Failed to load automation runs.' });
  }
});

router.get('/leads', async (req, res) => {
  const orgId = req.user.organization_id;
  const status = req.query.status;
  const limit = normalizeLimit(req.query.limit, 100);

  try {
    const filters = { organization_id: orgId };
    if (status) {
      filters.status = status;
    }

    const leads = await BusinessLead.findAll({
      where: filters,
      order: [['created_at', 'DESC']],
      limit,
      raw: true
    });

    res.json(leads);
  } catch (error) {
    console.error('Fetch leads error:', error);
    res.status(500).json({ error: 'Failed to load leads.' });
  }
});

router.post('/leads', async (req, res) => {
  const orgId = req.user.organization_id;
  const userId = req.user.id;
  const {
    name,
    email,
    phone,
    company,
    budget,
    score,
    status = 'new',
    source,
    notes,
    metadata = {}
  } = req.body || {};

  if (!name && !email) {
    return res.status(400).json({ error: 'Lead name or email is required.' });
  }

  try {
    const lead = await BusinessLead.create({
      organization_id: orgId,
      created_by: userId,
      name: name || null,
      email: email || null,
      phone: phone || null,
      company: company || null,
      budget: budget ? Number(budget) : null,
      score: score ? Number(score) : null,
      status,
      source: source || null,
      notes: notes || null,
      metadata: metadata || {}
    });

    logAuditAction(userId, 'CREATE_BUSINESS_LEAD', 'business_lead', lead.id, {
      name,
      email
    });

    res.status(201).json({ id: lead.id });
  } catch (error) {
    console.error('Create lead error:', error);
    res.status(500).json({ error: 'Failed to create lead.' });
  }
});

router.patch('/leads/:id', async (req, res) => {
  const orgId = req.user.organization_id;
  const userId = req.user.id;
  const leadId = req.params.id;
  const updates = req.body || {};

  if (!leadId) {
    return res.status(400).json({ error: 'Invalid lead id.' });
  }

  const allowed = [
    'name',
    'email',
    'phone',
    'company',
    'budget',
    'score',
    'status',
    'source',
    'notes',
    'metadata'
  ];

  const fields = allowed.filter((key) => updates[key] !== undefined);
  if (fields.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update.' });
  }

  try {
    const payload = {};
    fields.forEach((field) => {
      if (field === 'metadata') {
        payload.metadata = updates[field] || {};
      } else if (field === 'budget' || field === 'score') {
        payload[field] = updates[field] === null ? null : Number(updates[field]);
      } else {
        payload[field] = updates[field];
      }
    });

    const result = await BusinessLead.update(payload, {
      where: { id: leadId, organization_id: orgId }
    });

    if (result[0] === 0) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    logAuditAction(userId, 'UPDATE_BUSINESS_LEAD', 'business_lead', leadId, {
      fields
    });

    res.json({ status: 'updated' });
  } catch (error) {
    console.error('Update lead error:', error);
    res.status(500).json({ error: 'Failed to update lead.' });
  }
});

router.get('/emails', async (req, res) => {
  const orgId = req.user.organization_id;
  const limit = normalizeLimit(req.query.limit, 100);

  try {
    const emails = await BusinessEmail.findAll({
      where: { organization_id: orgId },
      order: [['processed_at', 'DESC']],
      limit,
      raw: true
    });

    res.json(emails);
  } catch (error) {
    console.error('Fetch emails error:', error);
    res.status(500).json({ error: 'Failed to load emails.' });
  }
});

router.post('/emails', async (req, res) => {
  const orgId = req.user.organization_id;
  const userId = req.user.id;
  const {
    from_address,
    to_address,
    subject,
    body,
    classification,
    action_taken,
    auto_classify = true,
    metadata = {}
  } = req.body || {};

  if (!from_address && !to_address && !subject && !body) {
    return res.status(400).json({ error: 'Email details are required.' });
  }

  let finalClassification = classification || null;
  let finalScore = null;

  if (auto_classify) {
    const text = `${subject || ''}\n${body || ''}`.trim();
    const categories = ['support', 'sales', 'billing', 'general'];
    try {
      const { label } = await aiService.classifyText(text, categories, 'email');
      finalClassification = label;
      finalScore = await aiService.scoreData({ subject, body }, 'urgency and intent');
    } catch (error) {
      console.error('Email classification failed:', error);
    }
  }

  try {
    const email = await BusinessEmail.create({
      organization_id: orgId,
      created_by: userId,
      from_address: from_address || null,
      to_address: to_address || null,
      subject: subject || null,
      body: body || null,
      classification: finalClassification,
      ai_score: finalScore,
      action_taken: action_taken || null,
      metadata: metadata || {}
    });

    logAuditAction(userId, 'LOG_BUSINESS_EMAIL', 'business_email', email.id, {
      classification: finalClassification
    });

    res.status(201).json({
      id: email.id,
      classification: finalClassification,
      ai_score: finalScore
    });
  } catch (error) {
    console.error('Create email error:', error);
    res.status(500).json({ error: 'Failed to log email.' });
  }
});

router.post('/emails/sync', async (req, res) => {
  const orgId = req.user.organization_id;
  const userId = req.user.id;
  const limit = normalizeLimit(req.body?.limit, 25);
  const provider = String(req.body?.provider || req.query?.provider || 'gmail').toLowerCase();

  try {
    const integration = await getIntegrationRecord(orgId, provider);
    if (!integration?.credentials) {
      return res.status(400).json({ error: `${provider.toUpperCase()} integration is not configured.` });
    }

    const mergedCredentials = {
      ...(integration.configuration?.metadata || {}),
      ...(integration.credentials || {})
    };
    let result;
    if (provider === 'gmail') {
      result = await syncGmailInbox({
        organizationId: orgId,
        userId,
        credentials: mergedCredentials,
        limit
      });
    } else if (provider === 'outlook') {
      result = await syncImapInbox({
        host: 'outlook.office365.com',
        provider: 'outlook',
        organizationId: orgId,
        userId,
        credentials: mergedCredentials,
        limit
      });
    } else {
      return res.status(400).json({ error: 'Unsupported email provider.' });
    }

    logAuditAction(userId, 'SYNC_BUSINESS_EMAILS', 'business_email', null, {
      provider,
      synced: result.synced || 0
    });

    res.json(result);
  } catch (error) {
    console.error('Email sync error:', error);
    res.status(500).json({ error: 'Failed to sync inbox.' });
  }
});

export default router;
