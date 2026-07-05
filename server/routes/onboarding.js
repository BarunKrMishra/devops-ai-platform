import express from 'express';
import { OnboardingProfile, OnboardingSetting, GoLiveRequest, User } from '../models/index.js';
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

const getOrgSettings = async (orgId) => {
  const settings = await OnboardingSetting.findOne({ where: { organization_id: orgId }, raw: true });
  if (settings) {
    return { demo_mode: Boolean(settings.demo_mode) };
  }

  await OnboardingSetting.create({ organization_id: orgId, demo_mode: true });
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

router.get('/status', async (req, res) => {
  const orgId = req.user.organization_id;
  const settings = await getOrgSettings(orgId);
  const profile = await OnboardingProfile.findOne({ where: { organization_id: orgId }, raw: true });

  if (!profile) {
    return res.json({ completed: false, demo_mode: settings.demo_mode });
  }

  res.json({
    completed: true,
    demo_mode: settings.demo_mode,
    profile: {
      ...profile,
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

  if (!account_type) {
    return res.status(400).json({ error: 'Account type is required.' });
  }

  if (!organization_name) {
    return res.status(400).json({ error: 'Organization name is required.' });
  }

  if (!company_domain) {
    return res.status(400).json({ error: 'Company domain is required.' });
  }

  if (!team_size || !role) {
    return res.status(400).json({ error: 'Team size and role are required.' });
  }

  const useCaseList = parseList(use_cases);
  if (useCaseList.length === 0) {
    return res.status(400).json({ error: 'Select at least one use case.' });
  }

  const cloudList = parseList(clouds);
  if (cloudList.length === 0) {
    return res.status(400).json({ error: 'Select at least one primary cloud.' });
  }

  const securityList = parseList(security_requirements);
  if (securityList.length === 0) {
    return res.status(400).json({ error: 'Select at least one security requirement.' });
  }

  if (!security_contact_email || !isValidEmail(security_contact_email)) {
    return res.status(400).json({ error: 'Valid security contact email is required.' });
  }

  if (!consent_terms || !consent_privacy) {
    return res.status(400).json({ error: 'Please accept the terms and privacy policy.' });
  }

  const payload = {
    organization_id: orgId,
    account_type,
    organization_name,
    company_domain,
    team_size,
    role,
    use_cases: useCaseList,
    clouds: cloudList,
    security_requirements: securityList,
    security_contact_email,
    ai_integration: Boolean(ai_integration),
    ai_provider: ai_provider || null,
    ai_integration_method: ai_integration_method || null,
    ai_integration_notes: ai_integration_notes || null,
    consent_terms: Boolean(consent_terms),
    consent_privacy: Boolean(consent_privacy)
  };

  const existing = await OnboardingProfile.findOne({ where: { organization_id: orgId } });
  if (existing) {
    await OnboardingProfile.update(payload, { where: { organization_id: orgId } });
  } else {
    await OnboardingProfile.create(payload);
  }

  await sendOnboardingEmail(payload);

  await User.update({ updated_at: new Date() }, { where: { id: userId } });

  res.json({ message: 'Onboarding details saved.' });
});

router.patch('/settings', async (req, res) => {
  const orgId = req.user.organization_id;
  const { demo_mode } = req.body || {};

  const existing = await OnboardingSetting.findOne({ where: { organization_id: orgId } });
  if (existing) {
    await OnboardingSetting.update({ demo_mode: Boolean(demo_mode) }, { where: { organization_id: orgId } });
  } else {
    await OnboardingSetting.create({ organization_id: orgId, demo_mode: Boolean(demo_mode) });
  }

  res.json({ message: 'Settings updated.' });
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
  } = req.body || {};

  if (!requirements_notes || !contact_email) {
    return res.status(400).json({ error: 'Requirements notes and contact email are required.' });
  }

  if (!isValidEmail(contact_email)) {
    return res.status(400).json({ error: 'Contact email is invalid.' });
  }

  const profile = await OnboardingProfile.findOne({ where: { organization_id: orgId }, raw: true });
  if (!profile) {
    return res.status(400).json({ error: 'Complete onboarding before requesting live data.' });
  }

  const requester = await User.findByPk(userId, { attributes: ['email', 'name'], raw: true });

  const requestPayload = {
    organization_id: orgId,
    requester_id: userId,
    requirements_notes,
    contact_email,
    ai_integration: Boolean(ai_integration),
    ai_provider: ai_provider || null,
    ai_integration_method: ai_integration_method || null,
    ai_integration_notes: ai_integration_notes || null,
    selected_features: parseList(selected_features),
    data_sources: parseList(data_sources),
    live_data_notes: live_data_notes || null
  };

  await GoLiveRequest.create(requestPayload);

  await sendGoLiveEmail({
    ...profile,
    ...requestPayload,
    requested_by: requester?.email || 'Unknown'
  });

  const settings = await OnboardingSetting.findOne({ where: { organization_id: orgId } });
  if (settings) {
    await OnboardingSetting.update({ demo_mode: false }, { where: { organization_id: orgId } });
  } else {
    await OnboardingSetting.create({ organization_id: orgId, demo_mode: false });
  }

  res.json({ message: 'Live data request submitted.' });
});

export default router;
