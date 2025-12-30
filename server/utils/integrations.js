import { db } from '../database/init.js';
import { decryptPayload } from './encryption.js';

const parseConfig = (value) => {
  if (!value) {
    return {};
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    return {};
  }
};

export const getIntegrationRecord = (organizationId, type) => {
  const row = db.prepare(
    `SELECT i.id, i.configuration, s.encrypted_payload
     FROM integrations i
     LEFT JOIN integration_secrets s ON s.integration_id = i.id
     WHERE i.organization_id = ? AND i.type = ? AND i.is_active = 1`
  ).get(organizationId, type);

  if (!row) {
    return null;
  }

  const configuration = parseConfig(row.configuration);
  let credentials = null;

  if (row.encrypted_payload) {
    try {
      const payload = JSON.parse(row.encrypted_payload);
      credentials = decryptPayload(payload);
    } catch (error) {
      console.error('Failed to decrypt integration payload:', error);
      credentials = null;
    }
  }

  return {
    id: row.id,
    configuration,
    credentials
  };
};
