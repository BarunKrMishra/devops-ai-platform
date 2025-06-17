import express from 'express';
import { db } from '../database/init.js';
import { createNotification } from './notifications.js';
import { triggerWebhook } from './webhooks.js';
import { logAuditAction } from '../utils/audit.js';

const router = express.Router();

// Get alert rules
router.get('/rules', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { project_id } = req.query;

    let query = `
      SELECT ar.*, p.name as project_name, u.name as created_by_name
      FROM alert_rules ar
      LEFT JOIN projects p ON ar.project_id = p.id
      LEFT JOIN users u ON ar.created_by = u.id
      WHERE p.organization_id = ?
    `;
    const params = [organizationId];

    if (project_id) {
      query += ` AND ar.project_id = ?`;
      params.push(project_id);
    }

    query += ` ORDER BY ar.created_at DESC`;

    const rules = db.prepare(query).all(...params);

    res.json(rules.map(rule => ({
      ...rule,
      escalation_chain: JSON.parse(rule.escalation_chain),
      notification_channels: JSON.parse(rule.notification_channels)
    })));
  } catch (error) {
    console.error('Alert rules fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch alert rules' });
  }
});

// Create alert rule
router.post('/rules', async (req, res) => {
  try {
    const {
      project_id,
      name,
      condition_type,
      threshold_value,
      comparison_operator,
      duration_minutes,
      escalation_chain,
      notification_channels
    } = req.body;
    const userId = req.user.id;

    const result = db.prepare(`
      INSERT INTO alert_rules (
        project_id, name, condition_type, threshold_value, comparison_operator,
        duration_minutes, escalation_chain, notification_channels, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      project_id,
      name,
      condition_type,
      threshold_value,
      comparison_operator,
      duration_minutes || 5,
      JSON.stringify(escalation_chain || []),
      JSON.stringify(notification_channels || []),
      userId
    );

    await logAuditAction(userId, 'CREATE_ALERT_RULE', 'alert_rule', result.lastInsertRowid, {
      name,
      condition_type,
      threshold_value
    });

    res.json({ id: result.lastInsertRowid, message: 'Alert rule created successfully' });
  } catch (error) {
    console.error('Alert rule creation error:', error);
    res.status(500).json({ error: 'Failed to create alert rule' });
  }
});

// Update alert rule
router.put('/rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      condition_type,
      threshold_value,
      comparison_operator,
      duration_minutes,
      escalation_chain,
      notification_channels,
      is_active
    } = req.body;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    // Verify rule belongs to organization
    const rule = db.prepare(`
      SELECT ar.id FROM alert_rules ar
      JOIN projects p ON ar.project_id = p.id
      WHERE ar.id = ? AND p.organization_id = ?
    `).get(id, organizationId);

    if (!rule) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }

    db.prepare(`
      UPDATE alert_rules 
      SET name = ?, condition_type = ?, threshold_value = ?, comparison_operator = ?,
          duration_minutes = ?, escalation_chain = ?, notification_channels = ?, is_active = ?
      WHERE id = ?
    `).run(
      name,
      condition_type,
      threshold_value,
      comparison_operator,
      duration_minutes,
      JSON.stringify(escalation_chain),
      JSON.stringify(notification_channels),
      is_active,
      id
    );

    await logAuditAction(userId, 'UPDATE_ALERT_RULE', 'alert_rule', id, {
      name,
      is_active
    });

    res.json({ message: 'Alert rule updated successfully' });
  } catch (error) {
    console.error('Alert rule update error:', error);
    res.status(500).json({ error: 'Failed to update alert rule' });
  }
});

// Delete alert rule
router.delete('/rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    // Verify rule belongs to organization
    const rule = db.prepare(`
      SELECT ar.name FROM alert_rules ar
      JOIN projects p ON ar.project_id = p.id
      WHERE ar.id = ? AND p.organization_id = ?
    `).get(id, organizationId);

    if (!rule) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }

    db.prepare('DELETE FROM alert_rules WHERE id = ?').run(id);

    await logAuditAction(userId, 'DELETE_ALERT_RULE', 'alert_rule', id, {
      name: rule.name
    });

    res.json({ message: 'Alert rule deleted successfully' });
  } catch (error) {
    console.error('Alert rule deletion error:', error);
    res.status(500).json({ error: 'Failed to delete alert rule' });
  }
});

// Get incidents
router.get('/incidents', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { status, severity, project_id } = req.query;

    let query = `
      SELECT i.*, p.name as project_name, ar.name as alert_rule_name, u.name as assigned_to_name
      FROM incidents i
      LEFT JOIN projects p ON i.project_id = p.id
      LEFT JOIN alert_rules ar ON i.alert_rule_id = ar.id
      LEFT JOIN users u ON i.assigned_to = u.id
      WHERE p.organization_id = ?
    `;
    const params = [organizationId];

    if (status) {
      query += ` AND i.status = ?`;
      params.push(status);
    }

    if (severity) {
      query += ` AND i.severity = ?`;
      params.push(severity);
    }

    if (project_id) {
      query += ` AND i.project_id = ?`;
      params.push(project_id);
    }

    query += ` ORDER BY i.created_at DESC`;

    const incidents = db.prepare(query).all(...params);

    res.json(incidents);
  } catch (error) {
    console.error('Incidents fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

// Create incident
router.post('/incidents', async (req, res) => {
  try {
    const {
      project_id,
      alert_rule_id,
      title,
      description,
      severity = 'medium'
    } = req.body;
    const userId = req.user.id;

    const result = db.prepare(`
      INSERT INTO incidents (project_id, alert_rule_id, title, description, severity)
      VALUES (?, ?, ?, ?, ?)
    `).run(project_id, alert_rule_id, title, description, severity);

    const incidentId = result.lastInsertRowid;

    // Create notification
    await createNotification({
      organization_id: req.user.organization_id,
      type: 'incident',
      title: `New ${severity} severity incident`,
      message: title,
      priority: severity === 'high' ? 'high' : 'normal',
      data: { incident_id: incidentId, project_id }
    });

    // Trigger webhooks
    await triggerWebhook('incident.created', {
      incident_id: incidentId,
      project_id,
      severity,
      title
    });

    await logAuditAction(userId, 'CREATE_INCIDENT', 'incident', incidentId, {
      title,
      severity,
      project_id
    });

    res.json({ id: incidentId, message: 'Incident created successfully' });
  } catch (error) {
    console.error('Incident creation error:', error);
    res.status(500).json({ error: 'Failed to create incident' });
  }
});

// Update incident
router.put('/incidents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, assigned_to, resolution_notes } = req.body;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    // Verify incident belongs to organization
    const incident = db.prepare(`
      SELECT i.title, i.status as current_status FROM incidents i
      JOIN projects p ON i.project_id = p.id
      WHERE i.id = ? AND p.organization_id = ?
    `).get(id, organizationId);

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const updateData = { status, assigned_to };
    if (status === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
      updateData.resolution_notes = resolution_notes;
    }

    const setClause = Object.keys(updateData)
      .map(key => `${key} = ?`)
      .join(', ');
    const values = Object.values(updateData);

    db.prepare(`UPDATE incidents SET ${setClause} WHERE id = ?`)
      .run(...values, id);

    // Create notification if status changed
    if (status !== incident.current_status) {
      await createNotification({
        organization_id: organizationId,
        type: 'incident_update',
        title: `Incident ${status}`,
        message: `${incident.title} has been ${status}`,
        data: { incident_id: id, status }
      });

      // Trigger webhooks
      await triggerWebhook('incident.updated', {
        incident_id: id,
        status,
        previous_status: incident.current_status
      });
    }

    await logAuditAction(userId, 'UPDATE_INCIDENT', 'incident', id, {
      status,
      assigned_to
    });

    res.json({ message: 'Incident updated successfully' });
  } catch (error) {
    console.error('Incident update error:', error);
    res.status(500).json({ error: 'Failed to update incident' });
  }
});

// Trigger alert (internal function for monitoring)
export const triggerAlert = async (alertRuleId, metricValue, projectId) => {
  try {
    const rule = db.prepare('SELECT * FROM alert_rules WHERE id = ? AND is_active = 1').get(alertRuleId);
    if (!rule) return;

    const escalationChain = JSON.parse(rule.escalation_chain);
    const notificationChannels = JSON.parse(rule.notification_channels);

    // Create incident
    const incident = db.prepare(`
      INSERT INTO incidents (project_id, alert_rule_id, title, description, severity)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      projectId,
      alertRuleId,
      `Alert: ${rule.name}`,
      `${rule.condition_type} ${rule.comparison_operator} ${rule.threshold_value} (current: ${metricValue})`,
      'medium'
    );

    // Send notifications based on escalation chain
    for (const userId of escalationChain) {
      await createNotification({
        user_id: userId,
        type: 'alert',
        title: `Alert: ${rule.name}`,
        message: `${rule.condition_type} threshold exceeded`,
        priority: 'high',
        data: { 
          incident_id: incident.lastInsertRowid,
          metric_value: metricValue,
          threshold: rule.threshold_value
        }
      });
    }

    // Trigger webhooks
    await triggerWebhook('alert.triggered', {
      alert_rule_id: alertRuleId,
      incident_id: incident.lastInsertRowid,
      project_id: projectId,
      metric_value: metricValue
    });

  } catch (error) {
    console.error('Alert trigger error:', error);
  }
};

export default router;