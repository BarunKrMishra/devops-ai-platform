import { db } from '../database/init.js';

const METRIC_RUN_INTERVAL_MS = 15 * 60 * 1000;

const insertMetric = (organizationId, metricType, value, unit) => {
  db.prepare(
    'INSERT INTO usage_metrics (organization_id, metric_type, value, unit) VALUES (?, ?, ?, ?)'
  ).run(organizationId, metricType, value, unit);
};

const collectOrgMetrics = (organizationId) => {
  const activeUsers = db.prepare(
    'SELECT COUNT(*) as count FROM users WHERE organization_id = ? AND is_active = 1'
  ).get(organizationId).count;

  const projects = db.prepare(
    'SELECT COUNT(*) as count FROM projects WHERE organization_id = ?'
  ).get(organizationId).count;

  const deployments = db.prepare(`
    SELECT COUNT(*) as count
    FROM deployments d
    JOIN projects p ON p.id = d.project_id
    WHERE p.organization_id = ? AND datetime(d.created_at) >= datetime('now', '-1 day')
  `).get(organizationId).count;

  const activeIntegrations = db.prepare(
    `SELECT COUNT(*) as count
     FROM integrations i
     LEFT JOIN integration_secrets s ON s.integration_id = i.id
     WHERE i.organization_id = ? AND i.is_active = 1 AND s.id IS NOT NULL`
  ).get(organizationId).count;

  const pendingInvites = db.prepare(`
    SELECT COUNT(*) as count
    FROM organization_invites
    WHERE organization_id = ? AND status = 'pending' AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))
  `).get(organizationId).count;

  insertMetric(organizationId, 'active_users', activeUsers, 'users');
  insertMetric(organizationId, 'projects', projects, 'projects');
  insertMetric(organizationId, 'deployments_24h', deployments, 'deployments');
  insertMetric(organizationId, 'active_integrations', activeIntegrations, 'connections');
  insertMetric(organizationId, 'pending_invites', pendingInvites, 'invites');
};

export const runUsageMetricsJob = () => {
  const organizations = db.prepare('SELECT id FROM organizations').all();
  organizations.forEach((org) => {
    try {
      collectOrgMetrics(org.id);
    } catch (error) {
      console.error('Usage metrics job error:', error);
    }
  });
};

export const startUsageMetricsJob = () => {
  runUsageMetricsJob();
  return setInterval(runUsageMetricsJob, METRIC_RUN_INTERVAL_MS);
};
