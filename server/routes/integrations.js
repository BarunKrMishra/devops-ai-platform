import express from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { fn, col } from 'sequelize';
import { Integration, IntegrationSecret, IntegrationEvent, BusinessEmail } from '../models/index.js';
import { encryptPayload } from '../utils/encryption.js';
import { getIntegrationRecord } from '../utils/integrations.js';
import { syncIntegration, supportedProviders } from '../services/integrations/syncManager.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();
const oauthCallbackRouter = express.Router();

// Connecting/disconnecting org-wide integration credentials is an admin/manager
// operation, consistent with every other organization-level mutation.
const requireManager = requireRole(['admin', 'manager']);

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
  'jenkins',
  'gmail',
  'outlook',
  'hubspot',
  'salesforce',
  'zoho',
  'intercom',
  'zendesk',
  'freshdesk',
  'twilio',
  'stripe',
  'google_sheets',
  'n8n',
  'make',
  'whatsapp',
  'quickbooks',
  'shopify',
  'jira',
  'clickup',
  'hubspot_marketing',
  'razorpay'
];

const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5173';
const AUTO_SYNC_ON_CONNECT = process.env.INTEGRATION_SYNC_AUTO_ON_CONNECT !== 'false';

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
  jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });

// --- Auto-detecting OAuth return URL ---------------------------------------
// The frontend URL to return to after OAuth is derived from the request that
// started the flow, so local and production work without editing .env. It is
// always validated against an allowlist to prevent open-redirects.
const parseOriginList = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const toOrigin = (value) => {
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
};

const DEFAULT_FRONTEND = process.env.APP_BASE_URL || 'http://localhost:5173';
const FRONTEND_ALLOWLIST = new Set(
  [
    'http://localhost:5173',
    'http://localhost:5174',
    process.env.APP_BASE_URL && toOrigin(process.env.APP_BASE_URL),
    ...parseOriginList(process.env.CORS_ORIGIN).map(toOrigin)
  ].filter(Boolean)
);

// Origin of the app that initiated the connect (from the browser request).
const resolveFrontendOrigin = (req) => {
  const candidate = toOrigin(req.get('origin') || req.get('referer') || '');
  if (candidate && FRONTEND_ALLOWLIST.has(candidate)) {
    return candidate;
  }
  return DEFAULT_FRONTEND;
};

// Only trust a return origin carried in state if it's still allow-listed.
const safeFrontendBase = (fo) =>
  fo && FRONTEND_ALLOWLIST.has(fo) ? fo : DEFAULT_FRONTEND;

const upsertIntegration = async ({ orgId, userId, provider, displayName, connectionMethod, metadata = {} }) => {
  const safeConfig = {
    connection_method: connectionMethod,
    metadata
  };

  const existing = await Integration.findOne({ where: { organization_id: orgId, type: provider } });
  if (existing) {
    await Integration.update(
      {
        name: displayName || provider.toUpperCase(),
        configuration: safeConfig,
        is_active: true
      },
      { where: { id: existing.id } }
    );
    return existing.id;
  }

  const integration = await Integration.create({
    organization_id: orgId,
    type: provider,
    name: displayName || provider.toUpperCase(),
    configuration: safeConfig,
    is_active: true,
    created_by: userId
  });

  return integration.id;
};

const storeCredentials = async ({ orgId, integrationId, credentials }) => {
  let encrypted;
  try {
    encrypted = encryptPayload(credentials);
  } catch (error) {
    console.error('Integration encryption failed:', error);
    throw new Error('Failed to secure credentials. Check master key.');
  }

  const existingSecret = await IntegrationSecret.findOne({ where: { integration_id: integrationId } });

  if (existingSecret) {
    await IntegrationSecret.update(
      { encrypted_payload: encrypted },
      { where: { integration_id: integrationId } }
    );
  } else {
    await IntegrationSecret.create({
      organization_id: orgId,
      integration_id: integrationId,
      encrypted_payload: encrypted
    });
  }
};

router.get('/', async (req, res) => {
  const orgId = req.user.organization_id;

  const integrations = await Integration.findAll({
    where: { organization_id: orgId },
    order: [['created_at', 'DESC']],
    raw: true
  });

  const integrationIds = integrations.map((integration) => integration.id);
  const secrets = integrationIds.length
    ? await IntegrationSecret.findAll({
        where: { integration_id: integrationIds },
        attributes: ['integration_id'],
        raw: true
      })
    : [];
  const secretSet = new Set(secrets.map((secret) => secret.integration_id));

  res.json(
    integrations.map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      is_active: Boolean(row.is_active),
      last_sync: row.last_sync,
      created_at: row.created_at,
      updated_at: row.updated_at,
      has_credentials: secretSet.has(row.id),
      configuration: row.configuration || {}
    }))
  );
});

router.post('/connect', requireManager, async (req, res) => {
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

  const integrationId = await upsertIntegration({
    orgId,
    userId,
    provider,
    displayName: display_name,
    connectionMethod: connection_method,
    metadata
  });

  try {
    await storeCredentials({ orgId, integrationId, credentials });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to secure credentials.' });
  }

  if (AUTO_SYNC_ON_CONNECT && supportedProviders.has(provider)) {
    setTimeout(async () => {
      try {
        await syncIntegration({
          provider,
          credentials,
          metadata,
          organizationId: orgId,
          userId,
          integrationId
        });
        await Integration.update({ last_sync: new Date() }, { where: { id: integrationId } });
      } catch (error) {
        console.error('Auto-sync after connect failed:', error.message || error);
      }
    }, 0);
  }

  return res.json({
    id: integrationId,
    type: provider,
    name: display_name || provider.toUpperCase(),
    is_active: true
  });
});

router.get('/oauth/:provider/start', requireManager, (req, res) => {
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
  const state = buildStateToken({ orgId, userId, provider, fo: resolveFrontendOrigin(req) });

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

    const integrationId = await upsertIntegration({
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

    await storeCredentials({
      orgId: statePayload.orgId,
      integrationId,
      credentials: tokenData
    });

    const frontendBase = safeFrontendBase(statePayload.fo);
    return res.redirect(
      `${frontendBase}/app/integrations?oauth=success&provider=${provider}`
    );
  } catch (err) {
    console.error('OAuth callback error:', err.response?.data || err);
    const frontendBase = safeFrontendBase(statePayload.fo);
    return res.redirect(
      `${frontendBase}/app/integrations?oauth=error&provider=${provider}`
    );
  }
});

router.post('/:id/disconnect', requireManager, async (req, res) => {
  const orgId = req.user.organization_id;
  const integrationId = req.params.id;

  const integration = await Integration.findOne({ where: { id: integrationId, organization_id: orgId } });

  if (!integration) {
    return res.status(404).json({ error: 'Integration not found.' });
  }

  await Integration.update({ is_active: false }, { where: { id: integrationId } });
  await IntegrationSecret.destroy({ where: { integration_id: integrationId } });

  return res.json({ disconnected: true });
});

router.get('/:id/summary', async (req, res) => {
  const orgId = req.user.organization_id;
  const integrationId = req.params.id;

  const integration = await Integration.findOne({
    where: { id: integrationId, organization_id: orgId },
    raw: true
  });

  if (!integration) {
    return res.status(404).json({ error: 'Integration not found.' });
  }

  const provider = integration.type;
  const supported = supportedProviders.has(provider);

  if (provider === 'gmail' || provider === 'outlook') {
    const total = await BusinessEmail.count({ where: { organization_id: orgId } });
    const latest = await BusinessEmail.findOne({
      where: { organization_id: orgId },
      order: [['processed_at', 'DESC']],
      attributes: ['processed_at'],
      raw: true
    });

    return res.json({
      provider,
      supported,
      last_sync: integration.last_sync,
      entities: { email: total },
      latest_activity: latest?.processed_at || null
    });
  }

  const summaryRows = await IntegrationEvent.findAll({
    where: { organization_id: orgId, provider },
    attributes: ['entity_type', [fn('COUNT', col('id')), 'count']],
    group: ['entity_type'],
    raw: true
  });

  const entities = summaryRows.reduce((acc, row) => {
    acc[row.entity_type] = Number(row.count);
    return acc;
  }, {});

  res.json({
    provider,
    supported,
    last_sync: integration.last_sync,
    entities
  });
});

router.post('/:id/sync', async (req, res) => {
  const orgId = req.user.organization_id;
  const userId = req.user.id;
  const integrationId = req.params.id;

  try {
    const integration = await Integration.findOne({
      where: { id: integrationId, organization_id: orgId }
    });

    if (!integration) {
      return res.status(404).json({ error: 'Integration not found.' });
    }

    if (!integration.is_active) {
      return res.status(400).json({ error: 'Integration is not active.' });
    }

    const record = await getIntegrationRecord(orgId, integration.type);
    if (!record?.credentials) {
      return res.status(400).json({ error: 'Integration credentials are missing.' });
    }

    if (!supportedProviders.has(integration.type)) {
      return res.status(400).json({ error: 'Sync is not available for this provider yet.' });
    }

    const result = await syncIntegration({
      provider: integration.type,
      credentials: record.credentials,
      metadata: record.configuration?.metadata || {},
      organizationId: orgId,
      userId,
      integrationId: integration.id
    });

    const lastSync = new Date();
    await Integration.update(
      { last_sync: lastSync },
      { where: { id: integration.id } }
    );

    res.json({
      ...result,
      last_sync: lastSync
    });
  } catch (error) {
    console.error('Integration sync error:', error);
    res.status(500).json({ error: error.message || 'Failed to sync integration.' });
  }
});

export { oauthCallbackRouter };
export default router;
