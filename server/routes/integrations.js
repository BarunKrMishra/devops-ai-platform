import express from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { db } from '../database/init.js';
import { encryptPayload } from '../utils/encryption.js';

const router = express.Router();
const oauthCallbackRouter = express.Router();

const SUPPORTED_PROVIDERS = [
  'github',
  'gitlab',
  'aws',
  'azure',
  'gcp',
  'datadog',
  'grafana',
  'prometheus',
  'slack',
  'pagerduty',
  'jenkins'
];

const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5173';

const getJwtSecret = () => {
  if (!JWT_SECRET) {
    throw new Error('JWT secret is not configured.');
  }
  return JWT_SECRET;
};

const getOAuthConfig = (provider) => {
  switch (provider) {
    case 'github':
      return {
        clientId: process.env.INTEGRATION_GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.INTEGRATION_GITHUB_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET,
        authUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        scope: 'repo read:org',
        responseType: 'code',
        tokenHeaders: { Accept: 'application/json' }
      };
    case 'gitlab':
      return {
        clientId: process.env.INTEGRATION_GITLAB_CLIENT_ID,
        clientSecret: process.env.INTEGRATION_GITLAB_CLIENT_SECRET,
        authUrl: 'https://gitlab.com/oauth/authorize',
        tokenUrl: 'https://gitlab.com/oauth/token',
        scope: 'read_api',
        responseType: 'code'
      };
    case 'slack':
      return {
        clientId: process.env.INTEGRATION_SLACK_CLIENT_ID,
        clientSecret: process.env.INTEGRATION_SLACK_CLIENT_SECRET,
        authUrl: 'https://slack.com/oauth/v2/authorize',
        tokenUrl: 'https://slack.com/api/oauth.v2.access',
        scope: 'chat:write,channels:read,team:read,users:read',
        responseType: 'code',
        tokenHeaders: { 'Content-Type': 'application/x-www-form-urlencoded' }
      };
    default:
      return null;
  }
};

const buildRedirectBase = (req) =>
  process.env.INTEGRATION_OAUTH_REDIRECT_BASE || `${req.protocol}://${req.get('host')}`;

const buildStateToken = (payload) =>
  jwt.sign(payload, getJwtSecret(), { expiresIn: '10m' });

const verifyStateToken = (token) =>
  jwt.verify(token, getJwtSecret());

const upsertIntegration = ({ orgId, userId, provider, displayName, connectionMethod, metadata = {} }) => {
  const existing = db.prepare(
    'SELECT id FROM integrations WHERE organization_id = ? AND type = ?'
  ).get(orgId, provider);

  const safeConfig = JSON.stringify({
    connection_method: connectionMethod,
    metadata
  });

  if (existing) {
    db.prepare(
      `UPDATE integrations
       SET name = ?,
           configuration = ?,
           is_active = 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(
      displayName || provider.toUpperCase(),
      safeConfig,
      existing.id
    );
    return existing.id;
  }

  const result = db.prepare(
    `INSERT INTO integrations
     (organization_id, type, name, configuration, is_active, created_by)
     VALUES (?, ?, ?, ?, 1, ?)`
  ).run(
    orgId,
    provider,
    displayName || provider.toUpperCase(),
    safeConfig,
    userId
  );

  return result.lastInsertRowid;
};

const storeCredentials = ({ orgId, integrationId, credentials }) => {
  let encrypted;
  try {
    encrypted = encryptPayload(credentials);
  } catch (error) {
    console.error('Integration encryption failed:', error);
    throw new Error('Failed to secure credentials. Check master key.');
  }

  const existingSecret = db.prepare(
    'SELECT id FROM integration_secrets WHERE integration_id = ?'
  ).get(integrationId);

  if (existingSecret) {
    db.prepare(
      `UPDATE integration_secrets
       SET encrypted_payload = ?, updated_at = CURRENT_TIMESTAMP
       WHERE integration_id = ?`
    ).run(JSON.stringify(encrypted), integrationId);
  } else {
    db.prepare(
      `INSERT INTO integration_secrets
       (organization_id, integration_id, encrypted_payload)
       VALUES (?, ?, ?)`
    ).run(orgId, integrationId, JSON.stringify(encrypted));
  }
};

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

router.get('/', (req, res) => {
  const orgId = req.user.organization_id;

  const rows = db.prepare(
    `SELECT i.*, s.id AS secret_id
     FROM integrations i
     LEFT JOIN integration_secrets s ON s.integration_id = i.id
     WHERE i.organization_id = ?
     ORDER BY i.created_at DESC`
  ).all(orgId);

  const integrations = rows.map((row) => ({
    id: row.id,
    type: row.type,
    name: row.name,
    is_active: Boolean(row.is_active),
    last_sync: row.last_sync,
    created_at: row.created_at,
    updated_at: row.updated_at,
    has_credentials: Boolean(row.secret_id),
    configuration: parseConfig(row.configuration)
  }));

  res.json(integrations);
});

router.post('/connect', (req, res) => {
  const orgId = req.user.organization_id;
  const userId = req.user.id;

  const {
    provider,
    display_name,
    connection_method = 'api',
    credentials,
    metadata = {}
  } = req.body;

  if (!provider || !SUPPORTED_PROVIDERS.includes(provider)) {
    return res.status(400).json({ error: 'Unsupported integration provider.' });
  }

  if (!credentials || typeof credentials !== 'object' || Object.keys(credentials).length === 0) {
    return res.status(400).json({ error: 'Credentials are required to connect.' });
  }

  const integrationId = upsertIntegration({
    orgId,
    userId,
    provider,
    displayName: display_name,
    connectionMethod: connection_method,
    metadata
  });

  try {
    storeCredentials({ orgId, integrationId, credentials });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to secure credentials.' });
  }

  return res.json({
    id: integrationId,
    type: provider,
    name: display_name || provider.toUpperCase(),
    is_active: true
  });
});

router.get('/oauth/:provider/start', (req, res) => {
  const { provider } = req.params;
  const orgId = req.user.organization_id;
  const userId = req.user.id;

  const config = getOAuthConfig(provider);
  if (!config) {
    return res.status(400).json({ error: 'OAuth is not available for this provider.' });
  }
  if (!config.clientId || !config.clientSecret) {
    return res.status(400).json({ error: 'OAuth client credentials are not configured.' });
  }

  const redirectBase = buildRedirectBase(req);
  const redirectUri = `${redirectBase}/api/integrations/oauth/${provider}/callback`;
  const state = buildStateToken({ orgId, userId, provider });

  const url = new URL(config.authUrl);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  if (config.responseType) {
    url.searchParams.set('response_type', config.responseType);
  }
  if (config.scope) {
    url.searchParams.set('scope', config.scope);
  }

  return res.json({ url: url.toString() });
});

oauthCallbackRouter.get('/:provider/callback', async (req, res) => {
  const { provider } = req.params;
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(
      `${FRONTEND_BASE_URL}/app/integrations?oauth=error&provider=${provider}`
    );
  }

  if (!code || !state) {
    return res.status(400).json({ error: 'OAuth code or state missing.' });
  }

  let statePayload;
  try {
    statePayload = verifyStateToken(state);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid OAuth state.' });
  }

  if (statePayload.provider !== provider) {
    return res.status(400).json({ error: 'OAuth provider mismatch.' });
  }

  const config = getOAuthConfig(provider);
  if (!config || !config.clientId || !config.clientSecret) {
    return res.status(400).json({ error: 'OAuth client credentials are not configured.' });
  }

  const redirectBase = buildRedirectBase(req);
  const redirectUri = `${redirectBase}/api/integrations/oauth/${provider}/callback`;

  try {
    const body = new URLSearchParams();
    body.set('client_id', config.clientId);
    body.set('client_secret', config.clientSecret);
    body.set('code', String(code));
    body.set('redirect_uri', redirectUri);
    if (provider === 'gitlab') {
      body.set('grant_type', 'authorization_code');
    }

    const tokenResponse = await axios.post(
      config.tokenUrl,
      body.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(config.tokenHeaders || {})
        }
      }
    );

    const tokenData = tokenResponse.data;
    if (provider === 'slack' && tokenData && tokenData.ok === false) {
      return res.status(400).json({ error: tokenData.error || 'Slack OAuth failed.' });
    }

    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return res.status(400).json({ error: 'OAuth token not returned.' });
    }

    const integrationId = upsertIntegration({
      orgId: statePayload.orgId,
      userId: statePayload.userId,
      provider,
      displayName: provider.toUpperCase(),
      connectionMethod: 'oauth',
      metadata: {
        scope: tokenData.scope || config.scope || null,
        token_type: tokenData.token_type || null
      }
    });

    storeCredentials({
      orgId: statePayload.orgId,
      integrationId,
      credentials: tokenData
    });

    return res.redirect(
      `${FRONTEND_BASE_URL}/app/integrations?oauth=success&provider=${provider}`
    );
  } catch (err) {
    console.error('OAuth callback error:', err.response?.data || err);
    return res.redirect(
      `${FRONTEND_BASE_URL}/app/integrations?oauth=error&provider=${provider}`
    );
  }
});

router.post('/:id/disconnect', (req, res) => {
  const orgId = req.user.organization_id;
  const integrationId = Number(req.params.id);

  const integration = db.prepare(
    'SELECT id FROM integrations WHERE id = ? AND organization_id = ?'
  ).get(integrationId, orgId);

  if (!integration) {
    return res.status(404).json({ error: 'Integration not found.' });
  }

  db.prepare(
    'UPDATE integrations SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(integrationId);

  db.prepare('DELETE FROM integration_secrets WHERE integration_id = ?').run(integrationId);

  return res.json({ disconnected: true });
});

export { oauthCallbackRouter };
export default router;
