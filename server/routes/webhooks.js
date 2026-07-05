import express from 'express';
import crypto from 'crypto';
import { Op, fn, col, where } from 'sequelize';
import { Webhook } from '../models/index.js';
import { logAuditAction } from '../utils/audit.js';

const router = express.Router();

// Get webhooks
router.get('/', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { project_id } = req.query;

    const filters = { organization_id: organizationId };
    if (project_id) {
      filters.project_id = project_id;
    }

    const webhooks = await Webhook.findAll({
      where: filters,
      order: [['created_at', 'DESC']],
      raw: true
    });

    res.json(
      webhooks.map((webhook) => ({
        ...webhook,
        events: webhook.events || [],
        secret: webhook.secret ? '***' : null
      }))
    );
  } catch (error) {
    console.error('Webhooks fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch webhooks' });
  }
});

// Create webhook
router.post('/', async (req, res) => {
  try {
    const { name, url, events, project_id } = req.body;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    const secret = crypto.randomBytes(32).toString('hex');

    const webhook = await Webhook.create({
      organization_id: organizationId,
      project_id: project_id || null,
      name,
      url,
      events: events || [],
      secret,
      created_by: userId
    });

    await logAuditAction(userId, 'CREATE_WEBHOOK', 'webhook', webhook.id, {
      name,
      url,
      events
    });

    res.json({
      id: webhook.id,
      secret,
      message: 'Webhook created successfully'
    });
  } catch (error) {
    console.error('Webhook creation error:', error);
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

// Update webhook
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, url, events, is_active } = req.body;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    const webhook = await Webhook.findOne({ where: { id, organization_id: organizationId }, raw: true });

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    await Webhook.update(
      {
        name: name ?? webhook.name,
        url: url ?? webhook.url,
        events: events ?? webhook.events,
        is_active: is_active ?? webhook.is_active
      },
      { where: { id } }
    );

    await logAuditAction(userId, 'UPDATE_WEBHOOK', 'webhook', id, {
      name,
      url,
      events,
      is_active
    });

    res.json({ message: 'Webhook updated successfully' });
  } catch (error) {
    console.error('Webhook update error:', error);
    res.status(500).json({ error: 'Failed to update webhook' });
  }
});

// Delete webhook
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    const webhook = await Webhook.findOne({ where: { id, organization_id: organizationId }, raw: true });

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    await Webhook.destroy({ where: { id } });

    await logAuditAction(userId, 'DELETE_WEBHOOK', 'webhook', id, {
      name: webhook.name
    });

    res.json({ message: 'Webhook deleted successfully' });
  } catch (error) {
    console.error('Webhook deletion error:', error);
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

// Trigger webhook (internal function)
export const triggerWebhook = async (event, data) => {
  try {
    const organizationId = data.organization_id;
    if (!organizationId) {
      return;
    }

    const projectFilter = data.project_id
      ? { [Op.or]: [{ project_id: null }, { project_id: data.project_id }] }
      : { project_id: null };

    const webhooks = await Webhook.findAll({
      where: {
        organization_id: organizationId,
        is_active: true,
        ...projectFilter,
        [Op.and]: [
          where(fn('JSON_CONTAINS', col('events'), JSON.stringify(event)), 1)
        ]
      },
      raw: true
    });

    for (const webhook of webhooks) {
      try {
        const payload = {
          event,
          timestamp: new Date().toISOString(),
          data
        };

        const signature = crypto
          .createHmac('sha256', webhook.secret)
          .update(JSON.stringify(payload))
          .digest('hex');

        console.log(`Triggering webhook ${webhook.name}: ${webhook.url}`, payload, signature);

        await Webhook.update({ last_triggered: new Date() }, { where: { id: webhook.id } });
      } catch (error) {
        console.error(`Webhook ${webhook.id} failed:`, error);
      }
    }
  } catch (error) {
    console.error('Webhook trigger error:', error);
  }
};

// Test webhook
router.post('/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    const webhook = await Webhook.findOne({ where: { id, organization_id: organizationId }, raw: true });

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    await triggerWebhook('webhook.test', {
      webhook_id: id,
      triggered_by: userId,
      message: 'This is a test webhook',
      organization_id: organizationId
    });

    res.json({ message: 'Test webhook sent successfully' });
  } catch (error) {
    console.error('Webhook test error:', error);
    res.status(500).json({ error: 'Failed to test webhook' });
  }
});

export default router;
