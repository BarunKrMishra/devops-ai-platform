import { createOpsService } from '../_shared/createOpsService.js';

createOpsService({
  key: 'ops-business',
  name: 'Business Ops',
  description: 'Automated business workflows with AI triage, lead scoring, and CRM sync.',
  defaultPort: 4011,
  integrations: [
    'Gmail',
    'Outlook',
    'HubSpot',
    'Salesforce',
    'Zoho',
    'Intercom',
    'Zendesk',
    'Freshdesk'
  ]
});
