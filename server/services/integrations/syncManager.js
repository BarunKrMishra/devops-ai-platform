import axios from 'axios';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { EC2Client, DescribeInstancesCommand } from '@aws-sdk/client-ec2';
import { IntegrationEvent, BusinessLead } from '../../models/index.js';
import { syncGmailInbox } from '../business/gmailSync.js';
import { syncImapInbox } from '../business/imapSync.js';

const buildBasicAuth = (username, password) =>
  Buffer.from(`${username}:${password}`, 'utf8').toString('base64');

const normalizeArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (value) {
    return [value];
  }
  return [];
};

const pickCredential = (credentials, keys) => {
  if (!credentials) {
    return null;
  }
  for (const key of keys) {
    const value = credentials[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return null;
};

const trimTrailingSlash = (value) => (value ? String(value).replace(/\/$/, '') : value);

const hashValue = (value) =>
  crypto.createHash('sha256').update(String(value)).digest('hex');

const parseServiceAccount = (value) => {
  if (!value) {
    return null;
  }
  if (typeof value === 'object') {
    return value;
  }
  const raw = String(value).trim();
  if (!raw) {
    return null;
  }
  let jsonText = raw;
  if (!raw.startsWith('{')) {
    try {
      jsonText = Buffer.from(raw, 'base64').toString('utf8');
    } catch (error) {
      jsonText = raw;
    }
  }
  return JSON.parse(jsonText);
};

const getGoogleAccessToken = async (serviceAccount, scope) => {
  const clientEmail = serviceAccount?.client_email;
  let privateKey = serviceAccount?.private_key;
  if (typeof privateKey === 'string') {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }
  if (!clientEmail || !privateKey) {
    throw new Error('Google service account JSON is incomplete.');
  }

  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: clientEmail,
      scope,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600
    },
    privateKey,
    { algorithm: 'RS256' }
  );

  const response = await axios.post(
    'https://oauth2.googleapis.com/token',
    new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    }).toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 20000
    }
  );

  return response.data?.access_token || null;
};

const getZohoDomains = (region) => {
  const normalized = (region || 'us').toLowerCase();
  if (normalized === 'eu') {
    return { accounts: 'zoho.eu', api: 'zohoapis.eu' };
  }
  if (normalized === 'in') {
    return { accounts: 'zoho.in', api: 'zohoapis.in' };
  }
  if (normalized === 'au') {
    return { accounts: 'zoho.com.au', api: 'zohoapis.com.au' };
  }
  if (normalized === 'jp') {
    return { accounts: 'zoho.jp', api: 'zohoapis.jp' };
  }
  return { accounts: 'zoho.com', api: 'zohoapis.com' };
};

const upsertEvents = async ({
  organizationId,
  integrationId,
  provider,
  entityType,
  items,
  mapPayload
}) => {
  let count = 0;
  for (const item of items) {
    const mapped = mapPayload(item);
    if (!mapped || !mapped.external_id) {
      continue;
    }
    await IntegrationEvent.upsert({
      organization_id: organizationId,
      integration_id: integrationId,
      provider,
      entity_type: entityType,
      external_id: String(mapped.external_id),
      payload: mapped.payload || {},
      synced_at: new Date()
    });
    count += 1;
  }
  return count;
};

const upsertLeadFromHubSpot = async ({ organizationId, userId, contact, source }) => {
  const props = contact.properties || {};
  const email = props.email;
  if (!email) {
    return false;
  }

  const nameParts = [props.firstname, props.lastname].filter(Boolean);
  const name = nameParts.length > 0 ? nameParts.join(' ') : null;
  const company = props.company || null;
  const status = props.lifecyclestage || 'new';

  const existing = await BusinessLead.findOne({
    where: { organization_id: organizationId, email }
  });

  const payload = {
    organization_id: organizationId,
    created_by: userId,
    name,
    email,
    company,
    status,
    source: source || 'hubspot',
    metadata: {
      hubspot_id: contact.id || null,
      lifecyclestage: props.lifecyclestage || null
    }
  };

  if (existing) {
    await BusinessLead.update(payload, { where: { id: existing.id } });
  } else {
    await BusinessLead.create(payload);
  }

  return true;
};

const syncGitHub = async ({ organizationId, integrationId, credentials, metadata }) => {
  const token = pickCredential(credentials, ['access_token', 'token', 'api_token', 'pat']);
  if (!token) {
    throw new Error('GitHub token missing.');
  }

  const org = metadata.organization || credentials.organization;
  const url = org
    ? `https://api.github.com/orgs/${encodeURIComponent(org)}/repos`
    : 'https://api.github.com/user/repos';

  const response = await axios.get(url, {
    headers: { Authorization: `token ${token}`, 'User-Agent': 'Aikya' },
    params: { per_page: 25, sort: 'updated' },
    timeout: 20000
  });

  const repos = normalizeArray(response.data);
  const count = await upsertEvents({
    organizationId,
    integrationId,
    provider: 'github',
    entityType: 'repo',
    items: repos,
    mapPayload: (repo) => ({
      external_id: repo.id,
      payload: {
        name: repo.name,
        full_name: repo.full_name,
        private: repo.private,
        language: repo.language,
        updated_at: repo.updated_at,
        url: repo.html_url
      }
    })
  });

  return { provider: 'github', entities: { repo: count } };
};

const syncGitLab = async ({ organizationId, integrationId, credentials, metadata }) => {
  const token = pickCredential(credentials, ['access_token', 'token', 'api_token', 'pat']);
  if (!token) {
    throw new Error('GitLab token missing.');
  }

  const group = metadata.group || credentials.group;
  const url = group
    ? `https://gitlab.com/api/v4/groups/${encodeURIComponent(group)}/projects`
    : 'https://gitlab.com/api/v4/projects';

  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'PRIVATE-TOKEN': token
    },
    params: group ? { per_page: 25, order_by: 'last_activity_at' } : { membership: true, per_page: 25 },
    timeout: 20000
  });

  const projects = normalizeArray(response.data);
  const count = await upsertEvents({
    organizationId,
    integrationId,
    provider: 'gitlab',
    entityType: 'project',
    items: projects,
    mapPayload: (project) => ({
      external_id: project.id,
      payload: {
        name: project.name,
        path: project.path_with_namespace,
        visibility: project.visibility,
        updated_at: project.last_activity_at,
        url: project.web_url
      }
    })
  });

  return { provider: 'gitlab', entities: { project: count } };
};

const syncJenkins = async ({ organizationId, integrationId, credentials, metadata }) => {
  const baseUrl = trimTrailingSlash(metadata.base_url || metadata.url || credentials.base_url || credentials.url);
  const username = credentials.username;
  const apiToken = credentials.api_token || credentials.token;
  const jobPrefix = metadata.job_prefix || credentials.job_prefix || '';

  if (!baseUrl || !username || !apiToken) {
    throw new Error('Jenkins credentials are incomplete.');
  }

  const response = await axios.get(`${baseUrl}/api/json`, {
    auth: { username, password: apiToken },
    params: { tree: 'jobs[name,url,color]' },
    timeout: 20000
  });

  const jobs = normalizeArray(response.data?.jobs || []);
  const filtered = jobPrefix
    ? jobs.filter((job) => job.name?.startsWith(jobPrefix))
    : jobs;

  const count = await upsertEvents({
    organizationId,
    integrationId,
    provider: 'jenkins',
    entityType: 'job',
    items: filtered,
    mapPayload: (job) => ({
      external_id: job.name,
      payload: {
        name: job.name,
        color: job.color,
        url: job.url
      }
    })
  });

  return { provider: 'jenkins', entities: { job: count } };
};

const syncAws = async ({ organizationId, integrationId, credentials, metadata }) => {
  const region = metadata.region || credentials.region || 'us-east-1';
  const accessKeyId = credentials.access_key_id;
  const secretAccessKey = credentials.secret_access_key;
  const sessionToken = credentials.session_token;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS credentials are incomplete.');
  }

  const client = new EC2Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
      sessionToken
    }
  });

  const response = await client.send(new DescribeInstancesCommand({ MaxResults: 25 }));
  const instances = [];
  for (const reservation of response.Reservations || []) {
    for (const instance of reservation.Instances || []) {
      instances.push(instance);
    }
  }

  const count = await upsertEvents({
    organizationId,
    integrationId,
    provider: 'aws',
    entityType: 'instance',
    items: instances,
    mapPayload: (instance) => ({
      external_id: instance.InstanceId,
      payload: {
        type: instance.InstanceType,
        state: instance.State?.Name || null,
        region,
        launch_time: instance.LaunchTime || null
      }
    })
  });

  return { provider: 'aws', entities: { instance: count } };
};

const syncAzure = async ({ organizationId, integrationId, credentials, metadata }) => {
  const tenantId = credentials.tenant_id;
  const clientId = credentials.client_id;
  const clientSecret = credentials.client_secret;
  const subscriptionId = metadata.subscription_id || credentials.subscription_id;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Azure credentials are incomplete.');
  }

  const tokenResponse = await axios.post(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://management.azure.com/.default'
    }).toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 20000
    }
  );

  const accessToken = tokenResponse.data?.access_token;
  if (!accessToken) {
    throw new Error('Azure access token missing.');
  }

  const response = await axios.get('https://management.azure.com/subscriptions', {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { 'api-version': '2020-01-01' },
    timeout: 20000
  });

  const subscriptions = normalizeArray(response.data?.value || []);
  const filtered = subscriptionId
    ? subscriptions.filter((sub) => sub.subscriptionId === subscriptionId)
    : subscriptions;

  const count = await upsertEvents({
    organizationId,
    integrationId,
    provider: 'azure',
    entityType: 'subscription',
    items: filtered,
    mapPayload: (sub) => ({
      external_id: sub.subscriptionId,
      payload: {
        display_name: sub.displayName,
        state: sub.state,
        tenant_id: sub.tenantId
      }
    })
  });

  return { provider: 'azure', entities: { subscription: count } };
};

const syncGcp = async ({ organizationId, integrationId, credentials, metadata }) => {
  const serviceAccount = parseServiceAccount(credentials.service_account_json || metadata.service_account_json);
  const projectFilter = metadata.project_id || credentials.project_id;

  const accessToken = await getGoogleAccessToken(
    serviceAccount,
    'https://www.googleapis.com/auth/cloud-platform.read-only'
  );

  if (!accessToken) {
    throw new Error('GCP access token missing.');
  }

  const response = await axios.get('https://cloudresourcemanager.googleapis.com/v1/projects', {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { pageSize: 50 },
    timeout: 20000
  });

  const projects = normalizeArray(response.data?.projects || []);
  const filtered = projectFilter
    ? projects.filter((project) => project.projectId === projectFilter)
    : projects;

  const count = await upsertEvents({
    organizationId,
    integrationId,
    provider: 'gcp',
    entityType: 'project',
    items: filtered,
    mapPayload: (project) => ({
      external_id: project.projectId,
      payload: {
        name: project.name,
        project_number: project.projectNumber,
        lifecycle_state: project.lifecycleState
      }
    })
  });

  return { provider: 'gcp', entities: { project: count } };
};

const syncDatadog = async ({ organizationId, integrationId, credentials, metadata }) => {
  const apiKey = credentials.api_key;
  const appKey = credentials.app_key;
  const site = (metadata.site || credentials.site || 'us1').toLowerCase();

  if (!apiKey || !appKey) {
    throw new Error('Datadog credentials are incomplete.');
  }

  const domain = site === 'us1' ? 'api.datadoghq.com' : `api.${site}.datadoghq.com`;
  const response = await axios.get(`https://${domain}/api/v1/hosts`, {
    headers: {
      'DD-API-KEY': apiKey,
      'DD-APPLICATION-KEY': appKey
    },
    params: { count: 25 },
    timeout: 20000
  });

  const hosts = normalizeArray(response.data?.host_list || []);
  const count = await upsertEvents({
    organizationId,
    integrationId,
    provider: 'datadog',
    entityType: 'host',
    items: hosts,
    mapPayload: (host) => ({
      external_id: host?.host_name || host?.host_id,
      payload: {
        name: host?.host_name || null,
        aliases: host?.aliases || [],
        apps: host?.apps || [],
        status: host?.status || null
      }
    })
  });

  return { provider: 'datadog', entities: { host: count } };
};

const syncGrafana = async ({ organizationId, integrationId, credentials, metadata }) => {
  const url = trimTrailingSlash(metadata.url || credentials.url);
  const apiToken = credentials.api_token || credentials.token;

  if (!url || !apiToken) {
    throw new Error('Grafana credentials are incomplete.');
  }

  const response = await axios.get(`${url}/api/search`, {
    headers: { Authorization: `Bearer ${apiToken}` },
    params: { limit: 25 },
    timeout: 20000
  });

  const dashboards = normalizeArray(response.data || []);
  const count = await upsertEvents({
    organizationId,
    integrationId,
    provider: 'grafana',
    entityType: 'dashboard',
    items: dashboards,
    mapPayload: (dash) => ({
      external_id: dash.uid || dash.id,
      payload: {
        title: dash.title,
        type: dash.type,
        url: dash.url
      }
    })
  });

  return { provider: 'grafana', entities: { dashboard: count } };
};

const syncPrometheus = async ({ organizationId, integrationId, credentials, metadata }) => {
  const endpoint = trimTrailingSlash(metadata.endpoint || credentials.endpoint);
  const bearer = credentials.bearer_token;

  if (!endpoint) {
    throw new Error('Prometheus endpoint missing.');
  }

  const response = await axios.get(`${endpoint}/api/v1/targets`, {
    headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
    timeout: 20000
  });

  const targets = normalizeArray(response.data?.data?.activeTargets || []);
  const count = await upsertEvents({
    organizationId,
    integrationId,
    provider: 'prometheus',
    entityType: 'target',
    items: targets,
    mapPayload: (target) => ({
      external_id: target.discoveredLabels?.instance || target.labels?.instance || target.scrapeUrl,
      payload: {
        job: target.labels?.job || null,
        health: target.health,
        scrape_url: target.scrapeUrl || null
      }
    })
  });

  return { provider: 'prometheus', entities: { target: count } };
};

const syncSlack = async ({ organizationId, integrationId, credentials }) => {
  const token = credentials.bot_token || credentials.access_token;
  if (!token) {
    throw new Error('Slack token missing.');
  }

  const response = await axios.get('https://slack.com/api/conversations.list', {
    headers: { Authorization: `Bearer ${token}` },
    params: { limit: 50 },
    timeout: 20000
  });

  if (response.data?.ok === false) {
    throw new Error(response.data?.error || 'Slack API error.');
  }

  const channels = normalizeArray(response.data?.channels || []);
  const count = await upsertEvents({
    organizationId,
    integrationId,
    provider: 'slack',
    entityType: 'channel',
    items: channels,
    mapPayload: (channel) => ({
      external_id: channel.id,
      payload: {
        name: channel.name,
        is_private: channel.is_private,
        is_archived: channel.is_archived
      }
    })
  });

  return { provider: 'slack', entities: { channel: count } };
};

const syncPagerDuty = async ({ organizationId, integrationId, credentials }) => {
  const token = credentials.api_token;
  if (!token) {
    throw new Error('PagerDuty API token missing.');
  }

  const response = await axios.get('https://api.pagerduty.com/services', {
    headers: {
      Authorization: `Token token=${token}`,
      Accept: 'application/vnd.pagerduty+json;version=2'
    },
    params: { limit: 50 },
    timeout: 20000
  });

  const services = normalizeArray(response.data?.services || []);
  const count = await upsertEvents({
    organizationId,
    integrationId,
    provider: 'pagerduty',
    entityType: 'service',
    items: services,
    mapPayload: (service) => ({
      external_id: service.id,
      payload: {
        name: service.name,
        status: service.status
      }
    })
  });

  return { provider: 'pagerduty', entities: { service: count } };
};

const syncOutlook = async ({ organizationId, userId, credentials, metadata, limit }) => {
  const merged = { ...(metadata || {}), ...(credentials || {}) };
  const result = await syncImapInbox({
    host: 'outlook.office365.com',
    provider: 'outlook',
    organizationId,
    userId,
    credentials: merged,
    limit
  });
  return { provider: 'outlook', entities: { email: result.synced || 0 }, reason: result.reason || null };
};

const syncHubSpot = async ({ organizationId, integrationId, userId, credentials, provider }) => {
  const accessToken = credentials.access_token;
  if (!accessToken) {
    throw new Error('HubSpot access token missing.');
  }

  const headers = { Authorization: `Bearer ${accessToken}` };
  let marketingEmails = [];

  try {
    const marketingResponse = await axios.get('https://api.hubapi.com/marketing/v3/emails/', {
      headers,
      timeout: 20000
    });
    marketingEmails = marketingResponse.data?.results || [];
  } catch (error) {
    console.warn('HubSpot marketing email sync skipped:', error.response?.status || error.message);
  }

  const contactsResponse = await axios.get('https://api.hubapi.com/crm/v3/objects/contacts', {
    headers,
    params: {
      limit: 50,
      properties: 'email,firstname,lastname,company,lifecyclestage'
    },
    timeout: 20000
  });

  const contacts = contactsResponse.data?.results || [];
  let leadCount = 0;

  for (const contact of contacts) {
    const created = await upsertLeadFromHubSpot({
      organizationId,
      userId,
      contact,
      source: provider
    });
    if (created) {
      leadCount += 1;
    }
  }

  const counts = {
    marketing_email: await upsertEvents({
      organizationId,
      integrationId,
      provider,
      entityType: 'marketing_email',
      items: marketingEmails,
      mapPayload: (email) => ({
        external_id: email.id,
        payload: {
          name: email.name,
          subject: email.subject,
          status: email.status,
          created: email.created
        }
      })
    }),
    contact: await upsertEvents({
      organizationId,
      integrationId,
      provider,
      entityType: 'contact',
      items: contacts,
      mapPayload: (contact) => ({
        external_id: contact.id,
        payload: {
          email: contact.properties?.email || null,
          firstname: contact.properties?.firstname || null,
          lastname: contact.properties?.lastname || null,
          company: contact.properties?.company || null,
          lifecyclestage: contact.properties?.lifecyclestage || null
        }
      })
    })
  };

  return { provider, entities: counts, leads_upserted: leadCount };
};

const syncSalesforce = async ({ organizationId, integrationId, credentials, metadata }) => {
  const instanceUrl = metadata.instance_url || credentials.instance_url;
  const clientId = credentials.client_id;
  const clientSecret = credentials.client_secret;
  const refreshToken = credentials.refresh_token;
  const loginUrl = metadata.login_url || credentials.login_url || 'https://login.salesforce.com';

  if (!instanceUrl || !clientId || !clientSecret || !refreshToken) {
    throw new Error('Salesforce credentials are incomplete.');
  }

  const tokenResponse = await axios.post(
    `${loginUrl}/services/oauth2/token`,
    new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken
    }).toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 20000
    }
  );

  const accessToken = tokenResponse.data?.access_token;
  const resolvedInstance = tokenResponse.data?.instance_url || instanceUrl;
  if (!accessToken || !resolvedInstance) {
    throw new Error('Salesforce access token missing.');
  }

  const query = 'SELECT Id, Name, Company, Status, Email FROM Lead ORDER BY LastModifiedDate DESC LIMIT 50';
  const response = await axios.get(`${trimTrailingSlash(resolvedInstance)}/services/data/v57.0/query`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { q: query },
    timeout: 20000
  });

  const leads = normalizeArray(response.data?.records || []);
  const count = await upsertEvents({
    organizationId,
    integrationId,
    provider: 'salesforce',
    entityType: 'lead',
    items: leads,
    mapPayload: (lead) => ({
      external_id: lead.Id,
      payload: {
        name: lead.Name,
        company: lead.Company,
        status: lead.Status,
        email: lead.Email
      }
    })
  });

  return { provider: 'salesforce', entities: { lead: count } };
};

const syncZoho = async ({ organizationId, integrationId, credentials, metadata }) => {
  const clientId = credentials.client_id;
  const clientSecret = credentials.client_secret;
  const refreshToken = credentials.refresh_token;
  const region = metadata.region || credentials.region || 'us';

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Zoho credentials are incomplete.');
  }

  const domains = getZohoDomains(region);
  const tokenResponse = await axios.post(
    `https://accounts.${domains.accounts}/oauth/v2/token`,
    new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token'
    }).toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 20000
    }
  );

  const accessToken = tokenResponse.data?.access_token;
  if (!accessToken) {
    throw new Error('Zoho access token missing.');
  }

  const response = await axios.get(`https://www.${domains.api}/crm/v2/Leads`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    params: { per_page: 50 },
    timeout: 20000
  });

  const leads = normalizeArray(response.data?.data || []);
  const count = await upsertEvents({
    organizationId,
    integrationId,
    provider: 'zoho',
    entityType: 'lead',
    items: leads,
    mapPayload: (lead) => ({
      external_id: lead.id,
      payload: {
        name: lead.Full_Name || lead.Last_Name,
        company: lead.Company,
        email: lead.Email,
        status: lead.Lead_Status
      }
    })
  });

  return { provider: 'zoho', entities: { lead: count } };
};

const syncIntercom = async ({ organizationId, integrationId, credentials }) => {
  const token = credentials.access_token;
  if (!token) {
    throw new Error('Intercom access token missing.');
  }

  const response = await axios.get('https://api.intercom.io/contacts', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    },
    params: { per_page: 50 },
    timeout: 20000
  });

  const contacts = normalizeArray(response.data?.data || []);
  const count = await upsertEvents({
    organizationId,
    integrationId,
    provider: 'intercom',
    entityType: 'contact',
    items: contacts,
    mapPayload: (contact) => ({
      external_id: contact.id,
      payload: {
        name: contact.name,
        email: contact.email,
        role: contact.role
      }
    })
  });

  return { provider: 'intercom', entities: { contact: count } };
};

const syncZendesk = async ({ organizationId, integrationId, credentials, metadata }) => {
  const subdomain = metadata.subdomain || credentials.subdomain;
  const email = metadata.email || credentials.email;
  const apiToken = credentials.api_token;

  if (!subdomain || !email || !apiToken) {
    throw new Error('Zendesk credentials are incomplete.');
  }

  const auth = buildBasicAuth(`${email}/token`, apiToken);
  const response = await axios.get(`https://${subdomain}.zendesk.com/api/v2/tickets.json`, {
    headers: { Authorization: `Basic ${auth}` },
    params: { per_page: 50 },
    timeout: 20000
  });

  const tickets = normalizeArray(response.data?.tickets || []);
  const count = await upsertEvents({
    organizationId,
    integrationId,
    provider: 'zendesk',
    entityType: 'ticket',
    items: tickets,
    mapPayload: (ticket) => ({
      external_id: ticket.id,
      payload: {
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        updated_at: ticket.updated_at
      }
    })
  });

  return { provider: 'zendesk', entities: { ticket: count } };
};

const syncFreshdesk = async ({ organizationId, integrationId, credentials, metadata }) => {
  const domain = metadata.domain || credentials.domain;
  const apiKey = credentials.api_key;

  if (!domain || !apiKey) {
    throw new Error('Freshdesk credentials are incomplete.');
  }

  const auth = buildBasicAuth(apiKey, 'X');
  const response = await axios.get(`https://${domain}.freshdesk.com/api/v2/tickets`, {
    headers: { Authorization: `Basic ${auth}` },
    params: { per_page: 50 },
    timeout: 20000
  });

  const tickets = normalizeArray(response.data || []);
  const count = await upsertEvents({
    organizationId,
    integrationId,
    provider: 'freshdesk',
    entityType: 'ticket',
    items: tickets,
    mapPayload: (ticket) => ({
      external_id: ticket.id,
      payload: {
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        created_at: ticket.created_at
      }
    })
  });

  return { provider: 'freshdesk', entities: { ticket: count } };
};

const syncTwilio = async ({ organizationId, integrationId, credentials }) => {
  const accountSid = credentials.account_sid;
  const authToken = credentials.auth_token;

  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials are incomplete.');
  }

  const response = await axios.get(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    auth: { username: accountSid, password: authToken },
    params: { PageSize: 50 },
    timeout: 20000
  });

  const messages = normalizeArray(response.data?.messages || []);
  const count = await upsertEvents({
    organizationId,
    integrationId,
    provider: 'twilio',
    entityType: 'message',
    items: messages,
    mapPayload: (message) => ({
      external_id: message.sid,
      payload: {
        to: message.to,
        from: message.from,
        status: message.status,
        date_sent: message.date_sent
      }
    })
  });

  return { provider: 'twilio', entities: { message: count } };
};

const syncStripe = async ({ organizationId, integrationId, credentials }) => {
  const secretKey = credentials.secret_key;
  if (!secretKey) {
    throw new Error('Stripe secret key missing.');
  }

  const response = await axios.get('https://api.stripe.com/v1/events', {
    headers: { Authorization: `Bearer ${secretKey}` },
    params: { limit: 25 },
    timeout: 20000
  });

  const events = normalizeArray(response.data?.data || []);
  const count = await upsertEvents({
    organizationId,
    integrationId,
    provider: 'stripe',
    entityType: 'event',
    items: events,
    mapPayload: (event) => ({
      external_id: event.id,
      payload: {
        type: event.type,
        created: event.created,
        livemode: event.livemode
      }
    })
  });

  return { provider: 'stripe', entities: { event: count } };
};

const syncWhatsApp = async ({ organizationId, integrationId, credentials }) => {
  const accessToken = credentials.access_token;
  const phoneNumberId = metadata.phone_number_id || credentials.phone_number_id;

  if (!accessToken || !phoneNumberId) {
    throw new Error('WhatsApp credentials are incomplete.');
  }

  const response = await axios.get(`https://graph.facebook.com/v19.0/${phoneNumberId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { fields: 'display_phone_number,verified_name,quality_rating' },
    timeout: 20000
  });

  const payload = response.data || {};
  const count = await upsertEvents({
    organizationId,
    integrationId,
    provider: 'whatsapp',
    entityType: 'account',
    items: [payload],
    mapPayload: (account) => ({
      external_id: phoneNumberId,
      payload: {
        display_phone_number: account.display_phone_number,
        verified_name: account.verified_name,
        quality_rating: account.quality_rating
      }
    })
  });

  return { provider: 'whatsapp', entities: { account: count } };
};

const syncGoogleSheets = async ({ organizationId, integrationId, credentials, metadata }) => {
  const sheetId = metadata.sheet_id || credentials.sheet_id;
  const serviceAccount = parseServiceAccount(credentials.service_account_json || metadata.service_account_json);

  if (!sheetId || !serviceAccount) {
    throw new Error('Google Sheets credentials are incomplete.');
  }

  const accessToken = await getGoogleAccessToken(
    serviceAccount,
    'https://www.googleapis.com/auth/spreadsheets.readonly'
  );

  if (!accessToken) {
    throw new Error('Google Sheets access token missing.');
  }

  const response = await axios.get(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 20000
  });

  const sheets = normalizeArray(response.data?.sheets || []);
  const count = await upsertEvents({
    organizationId,
    integrationId,
    provider: 'google_sheets',
    entityType: 'sheet',
    items: sheets,
    mapPayload: (sheet) => ({
      external_id: sheet.properties?.sheetId,
      payload: {
        title: sheet.properties?.title,
        index: sheet.properties?.index
      }
    })
  });

  return { provider: 'google_sheets', entities: { sheet: count } };
};

const syncWebhookProvider = async ({ provider, organizationId, integrationId, credentials, metadata }) => {
  const webhookUrl = metadata.webhook_url || credentials.webhook_url;
  if (!webhookUrl) {
    throw new Error(`${provider} webhook URL missing.`);
  }

  const apiKey = credentials.api_key || metadata.api_key;
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Aikya'
  };
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  let host = null;
  let path = null;
  try {
    const urlObj = new URL(webhookUrl);
    host = urlObj.host;
    path = urlObj.pathname;
  } catch (error) {
    throw new Error('Webhook URL is invalid.');
  }

  await axios.post(
    webhookUrl,
    {
      event: 'aikya.integration.test',
      provider,
      sent_at: new Date().toISOString()
    },
    {
      headers,
      timeout: 15000
    }
  );

  const safeKey = `${host}${path}`;
  const count = await upsertEvents({
    organizationId,
    integrationId,
    provider,
    entityType: 'webhook',
    items: [safeKey],
    mapPayload: (item) => ({
      external_id: hashValue(item),
      payload: {
        webhook_host: host,
        webhook_path: path
      }
    })
  });

  return { provider, entities: { webhook: count } };
};

const syncQuickBooks = async ({ organizationId, integrationId, credentials, metadata }) => {
  const clientId = credentials.client_id;
  const clientSecret = credentials.client_secret;
  const refreshToken = credentials.refresh_token;
  const realmId = metadata.realm_id || credentials.realm_id;

  if (!clientId || !clientSecret || !refreshToken || !realmId) {
    throw new Error('QuickBooks credentials are incomplete.');
  }

  const tokenResponse = await axios.post(
    'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    }).toString(),
    {
      headers: {
        Authorization: `Basic ${buildBasicAuth(clientId, clientSecret)}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 20000
    }
  );

  const accessToken = tokenResponse.data?.access_token;
  if (!accessToken) {
    throw new Error('QuickBooks access token missing.');
  }

  const baseUrl = `https://quickbooks.api.intuit.com/v3/company/${realmId}`;
  const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };

  const queryEntity = async (entity) => {
    const response = await axios.get(`${baseUrl}/query`, {
      headers,
      params: {
        query: `select * from ${entity} maxresults 25`
      },
      timeout: 20000
    });
    const queryResponse = response.data?.QueryResponse || {};
    return normalizeArray(queryResponse[entity]);
  };

  const [invoices, payments, customers] = await Promise.all([
    queryEntity('Invoice'),
    queryEntity('Payment'),
    queryEntity('Customer')
  ]);

  const counts = {
    invoice: await upsertEvents({
      organizationId,
      integrationId,
      provider: 'quickbooks',
      entityType: 'invoice',
      items: invoices,
      mapPayload: (invoice) => ({
        external_id: invoice.Id,
        payload: {
          doc_number: invoice.DocNumber,
          total: invoice.TotalAmt,
          balance: invoice.Balance,
          txn_date: invoice.TxnDate,
          customer: invoice.CustomerRef?.name || null,
          status: invoice.EmailStatus || null
        }
      })
    }),
    payment: await upsertEvents({
      organizationId,
      integrationId,
      provider: 'quickbooks',
      entityType: 'payment',
      items: payments,
      mapPayload: (payment) => ({
        external_id: payment.Id,
        payload: {
          total: payment.TotalAmt,
          txn_date: payment.TxnDate,
          customer: payment.CustomerRef?.name || null
        }
      })
    }),
    customer: await upsertEvents({
      organizationId,
      integrationId,
      provider: 'quickbooks',
      entityType: 'customer',
      items: customers,
      mapPayload: (customer) => ({
        external_id: customer.Id,
        payload: {
          display_name: customer.DisplayName,
          email: customer.PrimaryEmailAddr?.Address || null,
          phone: customer.PrimaryPhone?.FreeFormNumber || null
        }
      })
    })
  };

  return { provider: 'quickbooks', entities: counts };
};

const syncShopify = async ({ organizationId, integrationId, credentials, metadata }) => {
  const storeDomain = metadata.store_domain || credentials.store_domain;
  const accessToken = credentials.access_token;

  if (!storeDomain || !accessToken) {
    throw new Error('Shopify credentials are incomplete.');
  }

  const baseUrl = `https://${storeDomain}/admin/api/2024-01`;
  const headers = { 'X-Shopify-Access-Token': accessToken };

  const [ordersRes, customersRes] = await Promise.all([
    axios.get(`${baseUrl}/orders.json`, {
      headers,
      params: { status: 'any', limit: 25 },
      timeout: 20000
    }),
    axios.get(`${baseUrl}/customers.json`, {
      headers,
      params: { limit: 25 },
      timeout: 20000
    })
  ]);

  const orders = ordersRes.data?.orders || [];
  const customers = customersRes.data?.customers || [];

  const counts = {
    order: await upsertEvents({
      organizationId,
      integrationId,
      provider: 'shopify',
      entityType: 'order',
      items: orders,
      mapPayload: (order) => ({
        external_id: order.id,
        payload: {
          name: order.name,
          email: order.email,
          total_price: order.total_price,
          financial_status: order.financial_status,
          fulfillment_status: order.fulfillment_status,
          created_at: order.created_at
        }
      })
    }),
    customer: await upsertEvents({
      organizationId,
      integrationId,
      provider: 'shopify',
      entityType: 'customer',
      items: customers,
      mapPayload: (customer) => ({
        external_id: customer.id,
        payload: {
          email: customer.email,
          first_name: customer.first_name,
          last_name: customer.last_name,
          orders_count: customer.orders_count,
          total_spent: customer.total_spent,
          created_at: customer.created_at
        }
      })
    })
  };

  return { provider: 'shopify', entities: counts };
};

const syncJira = async ({ organizationId, integrationId, credentials, metadata }) => {
  const baseUrl = metadata.base_url || credentials.base_url;
  const email = metadata.email || credentials.email;
  const apiToken = credentials.api_token;

  if (!baseUrl || !email || !apiToken) {
    throw new Error('Jira credentials are incomplete.');
  }

  const auth = buildBasicAuth(email, apiToken);
  const response = await axios.get(`${trimTrailingSlash(baseUrl)}/rest/api/3/search`, {
    headers: { Authorization: `Basic ${auth}` },
    params: {
      jql: 'order by updated desc',
      maxResults: 50
    },
    timeout: 20000
  });

  const issues = response.data?.issues || [];

  const count = await upsertEvents({
    organizationId,
    integrationId,
    provider: 'jira',
    entityType: 'issue',
    items: issues,
    mapPayload: (issue) => ({
      external_id: issue.key || issue.id,
      payload: {
        key: issue.key,
        summary: issue.fields?.summary || null,
        status: issue.fields?.status?.name || null,
        priority: issue.fields?.priority?.name || null,
        updated: issue.fields?.updated || null
      }
    })
  });

  return { provider: 'jira', entities: { issue: count } };
};

const syncClickUp = async ({ organizationId, integrationId, credentials, metadata }) => {
  const accessToken = credentials.access_token;
  const workspaceId = metadata.workspace_id || credentials.workspace_id;

  if (!accessToken) {
    throw new Error('ClickUp access token missing.');
  }

  const headers = { Authorization: accessToken };
  let teamId = workspaceId;

  if (!teamId) {
    const teamResponse = await axios.get('https://api.clickup.com/api/v2/team', { headers, timeout: 20000 });
    teamId = teamResponse.data?.teams?.[0]?.id;
  }

  if (!teamId) {
    throw new Error('ClickUp workspace ID not found.');
  }

  const tasksResponse = await axios.get(`https://api.clickup.com/api/v2/team/${teamId}/task`, {
    headers,
    params: { archived: false, include_closed: true, order_by: 'updated', reverse: true },
    timeout: 20000
  });

  const tasks = tasksResponse.data?.tasks || [];

  const count = await upsertEvents({
    organizationId,
    integrationId,
    provider: 'clickup',
    entityType: 'task',
    items: tasks,
    mapPayload: (task) => ({
      external_id: task.id,
      payload: {
        name: task.name,
        status: task.status?.status || null,
        priority: task.priority?.priority || null,
        due_date: task.due_date,
        updated: task.date_updated
      }
    })
  });

  return { provider: 'clickup', entities: { task: count } };
};

const syncRazorpay = async ({ organizationId, integrationId, credentials }) => {
  const keyId = credentials.key_id;
  const keySecret = credentials.key_secret;
  if (!keyId || !keySecret) {
    throw new Error('Razorpay credentials are incomplete.');
  }

  const auth = buildBasicAuth(keyId, keySecret);
  const response = await axios.get('https://api.razorpay.com/v1/payments', {
    headers: { Authorization: `Basic ${auth}` },
    params: { count: 50 },
    timeout: 20000
  });

  const payments = response.data?.items || [];

  const count = await upsertEvents({
    organizationId,
    integrationId,
    provider: 'razorpay',
    entityType: 'payment',
    items: payments,
    mapPayload: (payment) => ({
      external_id: payment.id,
      payload: {
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        email: payment.email,
        contact: payment.contact,
        created_at: payment.created_at
      }
    })
  });

  return { provider: 'razorpay', entities: { payment: count } };
};

export const supportedProviders = new Set([
  'github',
  'gitlab',
  'jenkins',
  'aws',
  'azure',
  'gcp',
  'datadog',
  'grafana',
  'prometheus',
  'slack',
  'pagerduty',
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
]);

export const syncIntegration = async ({
  provider,
  credentials,
  metadata = {},
  organizationId,
  userId,
  integrationId
}) => {
  if (!supportedProviders.has(provider)) {
    throw new Error(`Sync is not available for ${provider}.`);
  }

  switch (provider) {
    case 'gmail': {
      const merged = { ...(metadata || {}), ...(credentials || {}) };
      const result = await syncGmailInbox({
        organizationId,
        userId,
        credentials: merged,
        limit: 25
      });
      return { provider, entities: { email: result.synced || 0 }, reason: result.reason || null };
    }
    case 'outlook':
      return syncOutlook({ organizationId, userId, credentials, metadata, limit: 25 });
    case 'github':
      return syncGitHub({ organizationId, integrationId, credentials, metadata });
    case 'gitlab':
      return syncGitLab({ organizationId, integrationId, credentials, metadata });
    case 'jenkins':
      return syncJenkins({ organizationId, integrationId, credentials, metadata });
    case 'aws':
      return syncAws({ organizationId, integrationId, credentials, metadata });
    case 'azure':
      return syncAzure({ organizationId, integrationId, credentials, metadata });
    case 'gcp':
      return syncGcp({ organizationId, integrationId, credentials, metadata });
    case 'datadog':
      return syncDatadog({ organizationId, integrationId, credentials, metadata });
    case 'grafana':
      return syncGrafana({ organizationId, integrationId, credentials, metadata });
    case 'prometheus':
      return syncPrometheus({ organizationId, integrationId, credentials, metadata });
    case 'slack':
      return syncSlack({ organizationId, integrationId, credentials });
    case 'pagerduty':
      return syncPagerDuty({ organizationId, integrationId, credentials });
    case 'hubspot':
    case 'hubspot_marketing':
      return syncHubSpot({ organizationId, integrationId, userId, credentials, provider });
    case 'salesforce':
      return syncSalesforce({ organizationId, integrationId, credentials, metadata });
    case 'zoho':
      return syncZoho({ organizationId, integrationId, credentials, metadata });
    case 'intercom':
      return syncIntercom({ organizationId, integrationId, credentials });
    case 'zendesk':
      return syncZendesk({ organizationId, integrationId, credentials, metadata });
    case 'freshdesk':
      return syncFreshdesk({ organizationId, integrationId, credentials, metadata });
    case 'twilio':
      return syncTwilio({ organizationId, integrationId, credentials });
    case 'stripe':
      return syncStripe({ organizationId, integrationId, credentials });
    case 'whatsapp':
      return syncWhatsApp({ organizationId, integrationId, credentials });
    case 'google_sheets':
      return syncGoogleSheets({ organizationId, integrationId, credentials, metadata });
    case 'n8n':
    case 'make':
      return syncWebhookProvider({ provider, organizationId, integrationId, credentials, metadata });
    case 'quickbooks':
      return syncQuickBooks({ organizationId, integrationId, credentials, metadata });
    case 'shopify':
      return syncShopify({ organizationId, integrationId, credentials, metadata });
    case 'jira':
      return syncJira({ organizationId, integrationId, credentials, metadata });
    case 'clickup':
      return syncClickUp({ organizationId, integrationId, credentials, metadata });
    case 'razorpay':
      return syncRazorpay({ organizationId, integrationId, credentials });
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
};
