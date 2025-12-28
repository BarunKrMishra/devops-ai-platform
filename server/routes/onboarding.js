import express from 'express';
import { db } from '../database/init.js';
import { createEmailTransport } from '../utils/email.js';

const router = express.Router();

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const parseList = (value) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

const integrationFieldMap = {
  'CI/CD': [
    { key: 'vcs_access', label: 'GitHub/GitLab access' },
    { key: 'build_secrets', label: 'Build secrets' },
    { key: 'deployment_target', label: 'Deployment target (Kubernetes/VM/Serverless)' }
  ],
  Infrastructure: [
    { key: 'cloud_credentials', label: 'Cloud account credentials' },
    { key: 'region_preferences', label: 'Region preferences' },
    { key: 'infra_templates', label: 'Infrastructure templates' }
  ],
  Monitoring: [
    { key: 'metrics_endpoint', label: 'Metrics endpoint' },
    { key: 'alert_channels', label: 'Alert channels' },
    { key: 'incident_routing', label: 'Incident routing' }
  ],
  Templates: [
    { key: 'template_library_access', label: 'Template library access' },
    { key: 'env_variables', label: 'Environment variables' },
    { key: 'approval_workflow', label: 'Approval workflow' }
  ],
  Team: [
    { key: 'team_roster', label: 'Team roster' },
    { key: 'role_mapping', label: 'Role mapping' },
    { key: 'sso_policy', label: 'SSO or invite policy' }
  ],
  Analytics: [
    { key: 'usage_metrics', label: 'Usage metrics' },
    { key: 'cost_reports', label: 'Cost reports' },
    { key: 'data_retention', label: 'Data retention policy' }
  ],
  Audit: [
    { key: 'audit_retention', label: 'Audit retention policy' },
    { key: 'export_destination', label: 'Export destination' },
    { key: 'compliance_scope', label: 'Compliance scope' }
  ],
  Settings: [
    { key: 'org_defaults', label: 'Org defaults' },
    { key: 'security_policies', label: 'Security policies' },
    { key: 'integration_owners', label: 'Integration owners' }
  ]
};

const getOrgSettings = (orgId) => {
  const settings = db.prepare(
    'SELECT demo_mode FROM organization_settings WHERE organization_id = ?'
  ).get(orgId);

  if (settings) {
    return { demo_mode: Boolean(settings.demo_mode) };
  }

  db.prepare(
    'INSERT INTO organization_settings (organization_id, demo_mode) VALUES (?, 1)'
  ).run(orgId);

  return { demo_mode: true };
};

const emailFrom = process.env.EMAIL_FROM || process.env.EMAIL_USER;
let transporter = createEmailTransport();

if (transporter) {
  transporter.verify((error) => {
    if (error) {
      console.error('Onboarding email transporter verification failed:', error);
    } else {
      console.log('Onboarding email transporter is ready to send messages');
    }
  });
}

const sendMailWithRetry = async (options) => {
  if (!transporter) {
    throw new Error('Email service not configured');
  }
  const maxAttempts = 3;
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      const result = await transporter.sendMail(options);
      console.log('Email sent:', result.messageId);
      return result;
    } catch (error) {
      attempt += 1;
      if (attempt >= maxAttempts) {
        throw error;
      }
      const delay = 500 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

const sendOnboardingEmail = async (payload) => {
  if (!transporter) {
    throw new Error('Email service not configured');
  }

  const inbox = process.env.BUSINESS_INBOX || process.env.EMAIL_USER;
  if (!inbox) {
    throw new Error('Business inbox not configured');
  }

  const lines = [
    'New Aikya onboarding submission',
    `Account type: ${payload.account_type}`,
    `Organization: ${payload.organization_name || 'N/A'}`,
    `Domain: ${payload.company_domain || 'N/A'}`,
    `Team size: ${payload.team_size || 'N/A'}`,
    `Role: ${payload.role || 'N/A'}`,
    `Use cases: ${payload.use_cases.join(', ') || 'N/A'}`,
    `Clouds: ${payload.clouds.join(', ') || 'N/A'}`,
    `Security: ${payload.security_requirements.join(', ') || 'N/A'}`,
    `Security contact: ${payload.security_contact_email || 'N/A'}`,
    `Bring own AI: ${payload.ai_integration ? 'Yes' : 'No'}`,
    `AI provider: ${payload.ai_provider || 'N/A'}`,
    `AI integration method: ${payload.ai_integration_method || 'N/A'}`,
    `AI notes: ${payload.ai_integration_notes || 'N/A'}`
  ];

  const html = `
    <div style="font-family: Arial, sans-serif;">
      <h2>New Aikya onboarding submission</h2>
      <ul>
        ${lines.map((line) => `<li>${line}</li>`).join('')}
      </ul>
    </div>
  `;

  await sendMailWithRetry({
    from: `Aikya Onboarding <${emailFrom}>`,
    to: inbox,
    subject: 'New Aikya onboarding submission',
    text: lines.join('\n'),
    html
  });
};

const sendGoLiveEmail = async (payload) => {
  if (!transporter) {
    throw new Error('Email service not configured');
  }

  const inbox = process.env.BUSINESS_INBOX || process.env.EMAIL_USER;
  if (!inbox) {
    throw new Error('Business inbox not configured');
  }

  const lines = [
    'Aikya go-live request',
    `Requester: ${payload.requested_by}`,
    `Account type: ${payload.account_type}`,
    `Organization: ${payload.organization_name || 'N/A'}`,
    `Domain: ${payload.company_domain || 'N/A'}`,
    `Team size: ${payload.team_size || 'N/A'}`,
    `Role: ${payload.role || 'N/A'}`,
    `Use cases: ${payload.use_cases.join(', ') || 'N/A'}`,
    `Clouds: ${payload.clouds.join(', ') || 'N/A'}`,
    `Security: ${payload.security_requirements.join(', ') || 'N/A'}`,
    `Security contact: ${payload.security_contact_email || 'N/A'}`,
    `Bring own AI: ${payload.ai_integration ? 'Yes' : 'No'}`,
    `AI provider: ${payload.ai_provider || 'N/A'}`,
    `AI integration method: ${payload.ai_integration_method || 'N/A'}`,
    `AI notes: ${payload.ai_integration_notes || 'N/A'}`,
    `Requested features: ${payload.selected_features.join(', ') || 'N/A'}`,
    `Live data sources: ${payload.data_sources?.length ? payload.data_sources.join(', ') : 'N/A'}`,
    `Live data notes: ${payload.live_data_notes || 'N/A'}`,
    `Requirements notes: ${payload.requirements_notes || 'N/A'}`,
    `Preferred contact email: ${payload.contact_email || 'N/A'}`,
    'Credentials are never requested in this form.'
  ];

  const html = `
    <div style="font-family: Arial, sans-serif;">
      <h2>Aikya go-live request</h2>
      <ul>
        ${lines.map((line) => `<li>${line}</li>`).join('')}
      </ul>
    </div>
  `;

  await sendMailWithRetry({
    from: `Aikya Go-Live <${emailFrom}>`,
    to: inbox,
    subject: 'Aikya go-live request',
    text: lines.join('\n'),
    html
  });
};

router.get('/status', (req, res) => {
  const orgId = req.user.organization_id;
  const settings = getOrgSettings(orgId);
  const profile = db.prepare(
    `SELECT account_type, organization_name, company_domain, team_size, role,
            use_cases, clouds, security_requirements, security_contact_email,
            ai_integration, ai_provider, ai_integration_method, ai_integration_notes,
            consent_terms, consent_privacy, created_at, updated_at
     FROM onboarding_profiles WHERE organization_id = ?`
  ).get(orgId);

  if (!profile) {
    return res.json({ completed: false, demo_mode: settings.demo_mode });
  }

  res.json({
    completed: true,
    demo_mode: settings.demo_mode,
    profile: {
      ...profile,
      use_cases: JSON.parse(profile.use_cases || '[]'),
      clouds: JSON.parse(profile.clouds || '[]'),
      security_requirements: JSON.parse(profile.security_requirements || '[]'),
      consent_terms: Boolean(profile.consent_terms),
      consent_privacy: Boolean(profile.consent_privacy),
      ai_integration: Boolean(profile.ai_integration)
    }
  });
});

router.post('/', async (req, res) => {
  const orgId = req.user.organization_id;
  const userId = req.user.id;

  const {
    account_type,
    organization_name,
    company_domain,
    team_size,
    role,
    use_cases,
    clouds,
    security_requirements,
    security_contact_email,
    ai_integration,
    ai_provider,
    ai_integration_method,
    ai_integration_notes,
    consent_terms,
    consent_privacy
  } = req.body;

  if (!account_type || !team_size || !role) {
    return res.status(400).json({ error: 'Account type, team size, and role are required.' });
  }

  if (!organization_name) {
    return res.status(400).json({ error: 'Organization name is required.' });
  }

  if (!company_domain) {
    return res.status(400).json({ error: 'Company domain is required.' });
  }

  if (!/^[^\s@]+\.[^\s@]+$/.test(company_domain)) {
    return res.status(400).json({ error: 'Company domain is invalid.' });
  }

  if (!security_contact_email) {
    return res.status(400).json({ error: 'Security contact email is required.' });
  }

  if (!isValidEmail(security_contact_email)) {
    return res.status(400).json({ error: 'Security contact email is invalid.' });
  }

  if (!consent_terms || !consent_privacy) {
    return res.status(400).json({ error: 'Terms and privacy consent are required.' });
  }

  const parsedUseCases = parseList(use_cases);
  const parsedClouds = parseList(clouds);
  const parsedSecurity = parseList(security_requirements);

  if (parsedUseCases.length === 0) {
    return res.status(400).json({ error: 'At least one use case is required.' });
  }

  if (parsedClouds.length === 0) {
    return res.status(400).json({ error: 'At least one primary cloud is required.' });
  }

  if (parsedSecurity.length === 0) {
    return res.status(400).json({ error: 'At least one security requirement is required.' });
  }
  const wantsAi = Boolean(ai_integration);

  const existing = db.prepare('SELECT id FROM onboarding_profiles WHERE organization_id = ?').get(orgId);

  if (existing) {
    db.prepare(
      `UPDATE onboarding_profiles
       SET account_type = ?,
           organization_name = ?,
           company_domain = ?,
           team_size = ?,
           role = ?,
           use_cases = ?,
           clouds = ?,
           security_requirements = ?,
           security_contact_email = ?,
           ai_integration = ?,
           ai_provider = ?,
           ai_integration_method = ?,
           ai_integration_notes = ?,
           consent_terms = ?,
           consent_privacy = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE organization_id = ?`
    ).run(
      account_type,
      organization_name,
      company_domain,
      team_size,
      role,
      JSON.stringify(parsedUseCases),
      JSON.stringify(parsedClouds),
      JSON.stringify(parsedSecurity),
      security_contact_email,
      wantsAi ? 1 : 0,
      ai_provider,
      ai_integration_method,
      ai_integration_notes,
      consent_terms ? 1 : 0,
      consent_privacy ? 1 : 0,
      orgId
    );
  } else {
    db.prepare(
      `INSERT INTO onboarding_profiles
       (organization_id, user_id, account_type, organization_name, company_domain, team_size, role,
        use_cases, clouds, security_requirements, security_contact_email,
        ai_integration, ai_provider, ai_integration_method, ai_integration_notes,
        consent_terms, consent_privacy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      orgId,
      userId,
      account_type,
      organization_name,
      company_domain,
      team_size,
      role,
      JSON.stringify(parsedUseCases),
      JSON.stringify(parsedClouds),
      JSON.stringify(parsedSecurity),
      security_contact_email,
      wantsAi ? 1 : 0,
      ai_provider,
      ai_integration_method,
      ai_integration_notes,
      consent_terms ? 1 : 0,
      consent_privacy ? 1 : 0
    );
  }

  try {
    await sendOnboardingEmail({
      account_type,
      organization_name,
      company_domain,
      team_size,
      role,
      use_cases: parsedUseCases,
      clouds: parsedClouds,
      security_requirements: parsedSecurity,
      security_contact_email,
      ai_integration: wantsAi,
      ai_provider,
      ai_integration_method,
      ai_integration_notes
    });
  } catch (error) {
    console.error('Onboarding email failed:', error);
    return res.status(500).json({ error: 'Failed to send onboarding email. Please try again.' });
  }

  return res.json({ completed: true });
});

router.patch('/settings', (req, res) => {
  const orgId = req.user.organization_id;
  const { demo_mode } = req.body;

  if (typeof demo_mode !== 'boolean') {
    return res.status(400).json({ error: 'demo_mode must be a boolean.' });
  }

  const existing = db.prepare(
    'SELECT id FROM organization_settings WHERE organization_id = ?'
  ).get(orgId);

  if (existing) {
    db.prepare(
      'UPDATE organization_settings SET demo_mode = ?, updated_at = CURRENT_TIMESTAMP WHERE organization_id = ?'
    ).run(demo_mode ? 1 : 0, orgId);
  } else {
    db.prepare(
      'INSERT INTO organization_settings (organization_id, demo_mode) VALUES (?, ?)'
    ).run(orgId, demo_mode ? 1 : 0);
  }

  return res.json({ demo_mode });
});

router.post('/request-live', async (req, res) => {
  const orgId = req.user.organization_id;
  const userId = req.user.id;
  const {
    requirements_notes,
    contact_email,
    ai_integration,
    ai_provider,
    ai_integration_method,
    ai_integration_notes,
    selected_features,
    data_sources,
    live_data_notes
  } = req.body;

  if (!requirements_notes || !requirements_notes.trim()) {
    return res.status(400).json({ error: 'Go-live requirements are required.' });
  }

  if (!contact_email || !isValidEmail(contact_email)) {
    return res.status(400).json({ error: 'A valid contact email is required.' });
  }

  const selectedFeatures = parseList(selected_features);
  if (selectedFeatures.length === 0) {
    return res.status(400).json({ error: 'Select at least one feature to enable.' });
  }

  const dataSources = parseList(data_sources);

  const profile = db.prepare(
    `SELECT account_type, organization_name, company_domain, team_size, role,
            use_cases, clouds, security_requirements, security_contact_email,
            ai_integration, ai_provider, ai_integration_method, ai_integration_notes
     FROM onboarding_profiles WHERE organization_id = ?`
  ).get(orgId);

  if (!profile) {
    return res.status(400).json({ error: 'Complete onboarding before requesting go-live.' });
  }

  const requester = db.prepare('SELECT email FROM users WHERE id = ?').get(userId);
  const wantsAi = typeof ai_integration === 'boolean' ? ai_integration : Boolean(profile.ai_integration);

  if (wantsAi && (!ai_provider || !ai_integration_method)) {
    return res.status(400).json({ error: 'AI provider and integration method are required.' });
  }

  const storedAiProvider = ai_provider || profile.ai_provider || null;
  const storedAiMethod = ai_integration_method || profile.ai_integration_method || null;
  const storedAiNotes = ai_integration_notes || profile.ai_integration_notes || null;

  try {
    db.prepare(
      `INSERT INTO go_live_requests
       (organization_id, user_id, selected_features, requirements_notes, contact_email,
        ai_integration, ai_provider, ai_integration_method, ai_integration_notes,
        data_sources, live_data_notes, integration_details, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      orgId,
      userId,
      JSON.stringify(selectedFeatures),
      requirements_notes,
      contact_email,
      wantsAi ? 1 : 0,
      storedAiProvider,
      storedAiMethod,
      storedAiNotes,
      JSON.stringify(dataSources),
      live_data_notes || null,
      JSON.stringify({}),
      'new'
    );
  } catch (error) {
    console.error('Go-live request storage failed:', error);
    return res.status(500).json({ error: 'Failed to store go-live request.' });
  }

  const existingSettings = db.prepare(
    'SELECT id FROM organization_settings WHERE organization_id = ?'
  ).get(orgId);

  if (existingSettings) {
    db.prepare(
      'UPDATE organization_settings SET demo_mode = 0, updated_at = CURRENT_TIMESTAMP WHERE organization_id = ?'
    ).run(orgId);
  } else {
    db.prepare(
      'INSERT INTO organization_settings (organization_id, demo_mode) VALUES (?, 0)'
    ).run(orgId);
  }

  try {
    await sendGoLiveEmail({
      requested_by: requester?.email || 'Unknown',
      account_type: profile.account_type,
      organization_name: profile.organization_name,
      company_domain: profile.company_domain,
      team_size: profile.team_size,
      role: profile.role,
      use_cases: JSON.parse(profile.use_cases || '[]'),
      clouds: JSON.parse(profile.clouds || '[]'),
      security_requirements: JSON.parse(profile.security_requirements || '[]'),
      security_contact_email: profile.security_contact_email,
      ai_integration: wantsAi,
      ai_provider: storedAiProvider,
      ai_integration_method: storedAiMethod,
      ai_integration_notes: storedAiNotes,
      selected_features: selectedFeatures,
      data_sources: dataSources,
      live_data_notes,
      requirements_notes,
      contact_email,
      integration_details: {}
    });
  } catch (error) {
    console.error('Go-live email failed:', error);
    return res.status(500).json({ error: 'Failed to send go-live request.' });
  }

  return res.json({ sent: true });
});

export default router;
