import { Integration, IntegrationSecret } from '../models/index.js';
import { decryptPayload } from './encryption.js';

export const getIntegrationRecord = async (organizationId, type) => {
  const integration = await Integration.findOne({
    where: {
      organization_id: organizationId,
      type,
      is_active: true
    }
  });

  if (!integration) {
    return null;
  }

  const secret = await IntegrationSecret.findOne({
    where: { integration_id: integration.id }
  });

  let credentials = null;

  if (secret?.encrypted_payload) {
    try {
      credentials = decryptPayload(secret.encrypted_payload);
    } catch (error) {
      console.error('Failed to decrypt integration payload:', error);
      credentials = null;
    }
  }

  return {
    id: integration.id,
    configuration: integration.configuration || {},
    credentials
  };
};
