import express from 'express';
import { Op } from 'sequelize';
import { AlertRule, Incident, Project, User } from '../models/index.js';
import { createNotification } from './notifications.js';
import { triggerWebhook } from './webhooks.js';
import { logAuditAction } from '../utils/audit.js';

const router = express.Router();

// Get alert rules
router.get('/rules', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { project_id } = req.query;

    const filters = { organization_id: organizationId };
    if (project_id) {
      filters.project_id = project_id;
    }

    const rules = await AlertRule.findAll({
      where: filters,
      order: [['created_at', 'DESC']],
      raw: true
    });

    const projectIds = Array.from(new Set(rules.map((rule) => rule.project_id).filter(Boolean)));
    const userIds = Array.from(new Set(rules.map((rule) => rule.created_by).filter(Boolean)));

    const projects = projectIds.length
      ? await Project.findAll({ where: { id: { [Op.in]: projectIds } }, attributes: ['id', 'name'], raw: true })
      : [];
    const users = userIds.length
      ? await User.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ['id', 'name'], raw: true })
      : [];

    const projectMap = projects.reduce((acc, project) => {
      acc[project.id] = project.name;
      return acc;
    }, {});

    const userMap = users.reduce((acc, user) => {
      acc[user.id] = user.name;
      return acc;
    }, {});

    res.json(
      rules.map((rule) => ({
        ...rule,
        project_name: projectMap[rule.project_id] || null,
        created_by_name: userMap[rule.created_by] || null,
        escalation_chain: rule.escalation_chain || [],
        notification_channels: rule.notification_channels || []
      }))
    );
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

    if (project_id) {
      const project = await Project.findOne({ where: { id: project_id, organization_id: req.user.organization_id } });
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
    }

    const rule = await AlertRule.create({
      organization_id: req.user.organization_id,
      project_id: project_id || null,
      name,
      condition_type,
      threshold_value,
      comparison_operator,
      duration_minutes: duration_minutes || 5,
      escalation_chain: escalation_chain || [],
      notification_channels: notification_channels || [],
      created_by: userId
    });

    await logAuditAction(userId, 'CREATE_ALERT_RULE', 'alert_rule', rule.id, {
      name,
      condition_type,
      threshold_value
    });

    res.json({ id: rule.id, message: 'Alert rule created successfully' });
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

    const rule = await AlertRule.findOne({ where: { id, organization_id: organizationId }, raw: true });

    if (!rule) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }

    const updatePayload = {
      name: name ?? rule.name,
      condition_type: condition_type ?? rule.condition_type,
      threshold_value: threshold_value ?? rule.threshold_value,
      comparison_operator: comparison_operator ?? rule.comparison_operator,
      duration_minutes: duration_minutes ?? rule.duration_minutes,
      escalation_chain: escalation_chain !== undefined ? escalation_chain : rule.escalation_chain,
      notification_channels: notification_channels !== undefined ? notification_channels : rule.notification_channels,
      is_active: is_active !== undefined ? is_active : rule.is_active
    };

    await AlertRule.update(updatePayload, { where: { id } });

    await logAuditAction(userId, 'UPDATE_ALERT_RULE', 'alert_rule', id, {
      name: updatePayload.name,
      is_active: updatePayload.is_active
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

    const rule = await AlertRule.findOne({ where: { id, organization_id: organizationId }, raw: true });

    if (!rule) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }

    await AlertRule.destroy({ where: { id } });

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

    const filters = { organization_id: organizationId };
    if (status) {
      filters.status = status;
    }
    if (severity) {
      filters.severity = severity;
    }
    if (project_id) {
      filters.project_id = project_id;
    }

    const incidents = await Incident.findAll({
      where: filters,
      order: [['created_at', 'DESC']],
      raw: true
    });

    const projectIds = Array.from(new Set(incidents.map((incident) => incident.project_id).filter(Boolean)));
    const alertRuleIds = Array.from(new Set(incidents.map((incident) => incident.alert_rule_id).filter(Boolean)));
    const assignedUserIds = Array.from(new Set(incidents.map((incident) => incident.assigned_to).filter(Boolean)));

    const projects = projectIds.length
      ? await Project.findAll({ where: { id: { [Op.in]: projectIds } }, attributes: ['id', 'name'], raw: true })
      : [];
    const alertRules = alertRuleIds.length
      ? await AlertRule.findAll({ where: { id: { [Op.in]: alertRuleIds } }, attributes: ['id', 'name'], raw: true })
      : [];
    const users = assignedUserIds.length
      ? await User.findAll({ where: { id: { [Op.in]: assignedUserIds } }, attributes: ['id', 'name'], raw: true })
      : [];

    const projectMap = projects.reduce((acc, project) => {
      acc[project.id] = project.name;
      return acc;
    }, {});
    const ruleMap = alertRules.reduce((acc, rule) => {
      acc[rule.id] = rule.name;
      return acc;
    }, {});
    const userMap = users.reduce((acc, user) => {
      acc[user.id] = user.name;
      return acc;
    }, {});

    res.json(
      incidents.map((incident) => ({
        ...incident,
        project_name: projectMap[incident.project_id] || null,
        alert_rule_name: ruleMap[incident.alert_rule_id] || null,
        assigned_to_name: userMap[incident.assigned_to] || null
      }))
    );
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

    if (project_id) {
      const project = await Project.findOne({ where: { id: project_id, organization_id: req.user.organization_id } });
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
    }

    const incident = await Incident.create({
      organization_id: req.user.organization_id,
      project_id: project_id || null,
      alert_rule_id: alert_rule_id || null,
      title,
      description,
      severity,
      created_by: userId
    });

    await createNotification({
      organization_id: req.user.organization_id,
      type: 'incident',
      title: `New ${severity} severity incident`,
      message: title,
      priority: severity === 'high' ? 'high' : 'normal',
      data: { incident_id: incident.id, project_id }
    });

    await triggerWebhook('incident.created', {
      incident_id: incident.id,
      project_id,
      severity,
      title,
      organization_id: req.user.organization_id
    });

    await logAuditAction(userId, 'CREATE_INCIDENT', 'incident', incident.id, {
      title,
      severity,
      project_id
    });

    res.json({ id: incident.id, message: 'Incident created successfully' });
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

    const incident = await Incident.findOne({ where: { id, organization_id: organizationId }, raw: true });

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const updateData = {};
    if (status !== undefined) {
      updateData.status = status;
    }
    if (assigned_to !== undefined) {
      updateData.assigned_to = assigned_to;
    }
    if (status === 'resolved') {
      updateData.resolved_at = new Date();
      updateData.resolution_notes = resolution_notes;
    }

    await Incident.update(updateData, { where: { id } });

    if (status && status !== incident.status) {
      await createNotification({
        organization_id: organizationId,
        type: 'incident_update',
        title: `Incident ${status}`,
        message: `${incident.title} has been ${status}`,
        data: { incident_id: id, status }
      });

      await triggerWebhook('incident.updated', {
        incident_id: id,
        status,
        previous_status: incident.status,
        organization_id: organizationId
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
    const rule = await AlertRule.findOne({ where: { id: alertRuleId, is_active: true }, raw: true });
    if (!rule) return;

    const escalationChain = Array.isArray(rule.escalation_chain) ? rule.escalation_chain : [];

    const incident = await Incident.create({
      organization_id: rule.organization_id,
      project_id: projectId || null,
      alert_rule_id: alertRuleId,
      title: `Alert: ${rule.name}`,
      description: `${rule.condition_type} ${rule.comparison_operator} ${rule.threshold_value} (current: ${metricValue})`,
      severity: 'medium'
    });

    for (const userId of escalationChain) {
      await createNotification({
        user_id: userId,
        organization_id: rule.organization_id,
        type: 'alert',
        title: `Alert: ${rule.name}`,
        message: `${rule.condition_type} threshold exceeded`,
        priority: 'high',
        data: {
          incident_id: incident.id,
          metric_value: metricValue,
          threshold: rule.threshold_value
        }
      });
    }

    await triggerWebhook('alert.triggered', {
      alert_rule_id: alertRuleId,
      incident_id: incident.id,
      project_id: projectId,
      metric_value: metricValue,
      organization_id: rule.organization_id
    });

  } catch (error) {
    console.error('Alert trigger error:', error);
  }
};

export default router;
