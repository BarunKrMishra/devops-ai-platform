import { Op } from 'sequelize';
import { Integration, IntegrationSecret } from '../models/index.js';
import { decryptPayload } from '../utils/encryption.js';
import { syncIntegration, supportedProviders } from '../services/integrations/syncManager.js';

const SYNC_ENABLED = process.env.INTEGRATION_SYNC_ENABLED !== 'false';
const SYNC_INTERVAL_MINUTES = Number(process.env.INTEGRATION_SYNC_INTERVAL_MINUTES) || 10;
const SYNC_BATCH_LIMIT = Number(process.env.INTEGRATION_SYNC_BATCH_LIMIT) || 25;

const buildCutoff = () =>
  new Date(Date.now() - SYNC_INTERVAL_MINUTES * 60 * 1000);

const fetchSyncCandidates = async () => {
  const cutoff = buildCutoff();
  return Integration.findAll({
    where: {
      is_active: true,
      [Op.or]: [{ last_sync: null }, { last_sync: { [Op.lt]: cutoff } }]
    },
    order: [['last_sync', 'ASC']],
    limit: SYNC_BATCH_LIMIT,
    raw: true
  });
};

const resolveCredentials = (encryptedPayload) => {
  if (!encryptedPayload) {
    return null;
  }
  try {
    return decryptPayload(encryptedPayload);
  } catch (error) {
    console.error('Failed to decrypt integration payload:', error);
    return null;
  }
};

export const runIntegrationSyncJob = async () => {
  if (!SYNC_ENABLED) {
    return;
  }

  const integrations = await fetchSyncCandidates();
  if (integrations.length === 0) {
    return;
  }

  const integrationIds = integrations.map((integration) => integration.id);
  const secrets = await IntegrationSecret.findAll({
    where: { integration_id: integrationIds },
    attributes: ['integration_id', 'encrypted_payload'],
    raw: true
  });
  const secretMap = new Map(secrets.map((secret) => [secret.integration_id, secret.encrypted_payload]));

  for (const integration of integrations) {
    if (!supportedProviders.has(integration.type)) {
      continue;
    }
    const encrypted = secretMap.get(integration.id);
    const credentials = resolveCredentials(encrypted);
    if (!credentials) {
      continue;
    }

    try {
      await syncIntegration({
        provider: integration.type,
        credentials,
        metadata: integration.configuration?.metadata || {},
        organizationId: integration.organization_id,
        userId: integration.created_by,
        integrationId: integration.id
      });

      await Integration.update(
        { last_sync: new Date() },
        { where: { id: integration.id } }
      );
    } catch (error) {
      console.error('Integration auto-sync failed:', integration.type, error.message || error);
    }
  }
};

export const startIntegrationSyncJob = () => {
  if (!SYNC_ENABLED) {
    return null;
  }

  runIntegrationSyncJob();
  return setInterval(runIntegrationSyncJob, SYNC_INTERVAL_MINUTES * 60 * 1000);
};
