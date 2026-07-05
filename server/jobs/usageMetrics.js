import { Op } from 'sequelize';
import { Organization, User, Project, Deployment, Integration, IntegrationSecret, OrganizationInvite, UsageMetric } from '../models/index.js';

const METRIC_RUN_INTERVAL_MS = 15 * 60 * 1000;

const insertMetric = async (organizationId, metricType, value, unit) => {
  await UsageMetric.create({
    organization_id: organizationId,
    metric_type: metricType,
    value,
    unit
  });
};

const collectOrgMetrics = async (organizationId) => {
  const activeUsers = await User.count({ where: { organization_id: organizationId, is_active: true } });
  const projects = await Project.count({ where: { organization_id: organizationId } });

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const deployments = await Deployment.count({
    where: {
      organization_id: organizationId,
      created_at: { [Op.gte]: yesterday }
    }
  });

  const integrationsWithSecrets = await IntegrationSecret.findAll({ attributes: ['integration_id'] });
  const integrationIds = integrationsWithSecrets.map((row) => row.integration_id);
  const activeWithSecrets = integrationIds.length === 0
    ? 0
    : await Integration.count({
        where: {
          organization_id: organizationId,
          is_active: true,
          id: { [Op.in]: integrationIds }
        }
      });

  const pendingInvites = await OrganizationInvite.count({
    where: {
      organization_id: organizationId,
      status: 'pending',
      [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: new Date() } }]
    }
  });

  await insertMetric(organizationId, 'active_users', activeUsers, 'users');
  await insertMetric(organizationId, 'projects', projects, 'projects');
  await insertMetric(organizationId, 'deployments_24h', deployments, 'deployments');
  await insertMetric(organizationId, 'active_integrations', activeWithSecrets, 'connections');
  await insertMetric(organizationId, 'pending_invites', pendingInvites, 'invites');
};

export const runUsageMetricsJob = async () => {
  const organizations = await Organization.findAll({ attributes: ['id'] });
  for (const org of organizations) {
    try {
      await collectOrgMetrics(org.id);
    } catch (error) {
      console.error('Usage metrics job error:', error);
    }
  }
};

export const startUsageMetricsJob = () => {
  runUsageMetricsJob();
  return setInterval(runUsageMetricsJob, METRIC_RUN_INTERVAL_MS);
};
