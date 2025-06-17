import express from 'express';
import crypto from 'crypto';
import { db } from '../database/init.js';
import { logAuditAction } from '../utils/audit.js';

const router = express.Router();

// Get webhooks
router.get('/', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { project_id } = req.query;

    let query = `
      SELECT w.*, u.name as created_by_name, p.name as project_name
      FROM webhooks w
      LEFT JOIN users u ON w.created_by = u.id
      LEFT JOIN projects p ON w.project_id = p.id
      WHERE w.organization_id = ?
    `;
    const params = [organizationId];

    if (project_id) {
      query += ` AND w.project_id = ?`;
      params.push(project_id);
    }

    query += ` ORDER BY w.created_at DESC`;

    const webhooks = db.prepare(query).all(...params);

    res.json(webhooks.map(webhook => ({
      ...webhook,
      events: JSON.parse(webhook.events),
      secret: webhook.secret ? '***' : null // Hide secret in response
    })));
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

    // Generate webhook secret
    const secret = crypto.randomBytes(32).toString('hex');

    const result = db.prepare(`
      INSERT INTO webhooks (organization_id, project_id, name, url, events, secret, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      organizationId,
      project_id || null,
      name,
      url,
      JSON.stringify(events),
      secret,
      userId
    );

    await logAuditAction(userId, 'CREATE_WEBHOOK', 'webhook', result.lastInsertRowid, {
      name,
      url,
      events
    });

    res.json({ 
      id: result.lastInsertRowid, 
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

    // Verify webhook belongs to organization
    const webhook = db.prepare(`
      SELECT id FROM webhooks 
      WHERE id = ? AND organization_id = ?
    `).get(id, organizationId);

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    db.prepare(`
      UPDATE webhooks 
      SET name = ?, url = ?, events = ?, is_active = ?
      WHERE id = ?
    `).run(name, url, JSON.stringify(events), is_active, id);

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

    // Verify webhook belongs to organization
    const webhook = db.prepare(`
      SELECT name FROM webhooks 
      WHERE id = ? AND organization_id = ?
    `).get(id, organizationId);

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    db.prepare('DELETE FROM webhooks WHERE id = ?').run(id);

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
    const webhooks = db.prepare(`
      SELECT * FROM webhooks 
      WHERE is_active = 1 
      AND (project_id IS NULL OR project_id = ?)
      AND JSON_EXTRACT(events, '$') LIKE '%${event}%'
    `).all(data.project_id || null);

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

        // In production, make HTTP request to webhook URL
        console.log(`Triggering webhook ${webhook.name}: ${webhook.url}`, payload);

        // Update last triggered timestamp
        db.prepare('UPDATE webhooks SET last_triggered = CURRENT_TIMESTAMP WHERE id = ?')
          .run(webhook.id);

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

    const webhook = db.prepare(`
      SELECT * FROM webhooks 
      WHERE id = ? AND organization_id = ?
    `).get(id, organizationId);

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    await triggerWebhook('webhook.test', {
      webhook_id: id,
      triggered_by: userId,
      message: 'This is a test webhook'
    });

    res.json({ message: 'Test webhook sent successfully' });
  } catch (error) {
    console.error('Webhook test error:', error);
    res.status(500).json({ error: 'Failed to test webhook' });
  }
});

export default router;