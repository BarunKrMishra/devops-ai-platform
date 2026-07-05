export type IntegrationField = {
  key: string;
  label: string;
  type: 'text' | 'password' | 'textarea' | 'select';
  required?: boolean;
  secret?: boolean;
  options?: string[];
  placeholder?: string;
};

export type ProviderConfig = {
  key: string;
  name: string;
  description: string;
  category: string;
  oauth?: boolean;
  fields: IntegrationField[];
  helper?: string;
};

export const providers: ProviderConfig[] = [
  {
    key: 'github',
    name: 'GitHub',
    description: 'Sync repositories, pipelines, and deploy events.',
    category: 'Source Control',
    oauth: true,
    helper: 'Use a fine-grained token with repo and read:org scopes.',
    fields: [
      { key: 'token', label: 'Access token', type: 'password', required: true, secret: true },
      { key: 'organization', label: 'Organization (optional)', type: 'text', placeholder: 'acme-org' }
    ]
  },
  {
    key: 'gitlab',
    name: 'GitLab',
    description: 'Connect CI/CD pipelines and merge activity.',
    category: 'Source Control',
    oauth: true,
    helper: 'Use a personal access token with read_api scope.',
    fields: [
      { key: 'token', label: 'Access token', type: 'password', required: true, secret: true },
      { key: 'group', label: 'Group (optional)', type: 'text', placeholder: 'team-platform' }
    ]
  },
  {
    key: 'jenkins',
    name: 'Jenkins',
    description: 'Pull pipeline runs and job statuses.',
    category: 'CI/CD',
    helper: 'Use a Jenkins API token with read access.',
    fields: [
      { key: 'base_url', label: 'Jenkins URL', type: 'text', required: true, placeholder: 'https://jenkins.company.com' },
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'api_token', label: 'API token', type: 'password', required: true, secret: true },
      { key: 'job_prefix', label: 'Job folder (optional)', type: 'text', placeholder: 'team-folder/' }
    ]
  },
  {
    key: 'aws',
    name: 'AWS',
    description: 'Stream infrastructure, cost, and deployment signals.',
    category: 'Cloud',
    helper: 'Use least-privilege IAM credentials or role ARN.',
    fields: [
      { key: 'access_key_id', label: 'Access key ID', type: 'text', required: true, secret: true },
      { key: 'secret_access_key', label: 'Secret access key', type: 'password', required: true, secret: true },
      { key: 'region', label: 'Primary region', type: 'text', placeholder: 'ap-south-1' },
      { key: 'role_arn', label: 'Role ARN (optional)', type: 'text' }
    ]
  },
  {
    key: 'azure',
    name: 'Azure',
    description: 'Connect subscriptions and monitor resource health.',
    category: 'Cloud',
    helper: 'Create an app registration and paste tenant/client details.',
    fields: [
      { key: 'tenant_id', label: 'Tenant ID', type: 'text', required: true, secret: true },
      { key: 'client_id', label: 'Client ID', type: 'text', required: true, secret: true },
      { key: 'client_secret', label: 'Client secret', type: 'password', required: true, secret: true },
      { key: 'subscription_id', label: 'Subscription ID', type: 'text' }
    ]
  },
  {
    key: 'gcp',
    name: 'GCP',
    description: 'Ingest project metrics and infra inventory.',
    category: 'Cloud',
    helper: 'Paste a service account JSON with viewer access.',
    fields: [
      { key: 'project_id', label: 'Project ID', type: 'text', required: true, secret: true },
      { key: 'service_account_json', label: 'Service account JSON', type: 'textarea', required: true, secret: true }
    ]
  },
  {
    key: 'datadog',
    name: 'Datadog',
    description: 'Stream metrics and incident alerts.',
    category: 'Monitoring',
    helper: 'Provide API + application keys from Datadog.',
    fields: [
      { key: 'api_key', label: 'API key', type: 'password', required: true, secret: true },
      { key: 'app_key', label: 'Application key', type: 'password', required: true, secret: true },
      { key: 'site', label: 'Site', type: 'select', options: ['us1', 'us3', 'us5', 'eu1'] }
    ]
  },
  {
    key: 'grafana',
    name: 'Grafana',
    description: 'Pull dashboards and alert rules.',
    category: 'Monitoring',
    helper: 'Use a Grafana API token with read access.',
    fields: [
      { key: 'url', label: 'Grafana URL', type: 'text', required: true, secret: true },
      { key: 'api_token', label: 'API token', type: 'password', required: true, secret: true }
    ]
  },
  {
    key: 'prometheus',
    name: 'Prometheus',
    description: 'Stream metrics endpoints into Aikya.',
    category: 'Monitoring',
    helper: 'Provide the Prometheus endpoint and optional token.',
    fields: [
      { key: 'endpoint', label: 'Prometheus URL', type: 'text', required: true, secret: true },
      { key: 'bearer_token', label: 'Bearer token (optional)', type: 'password', secret: true }
    ]
  },
  {
    key: 'slack',
    name: 'Slack',
    description: 'Route alerts and release updates to channels.',
    category: 'Collaboration',
    oauth: true,
    helper: 'Use a bot token from your Slack app.',
    fields: [
      { key: 'bot_token', label: 'Bot token', type: 'password', required: true, secret: true },
      { key: 'workspace', label: 'Workspace', type: 'text', placeholder: 'acme' }
    ]
  },
  {
    key: 'pagerduty',
    name: 'PagerDuty',
    description: 'Wire incidents and escalation policies.',
    category: 'Collaboration',
    helper: 'Provide a REST API key to sync services.',
    fields: [
      { key: 'api_token', label: 'API token', type: 'password', required: true, secret: true },
      { key: 'service_id', label: 'Service ID (optional)', type: 'text' }
    ]
  },
  {
    key: 'gmail',
    name: 'Gmail',
    description: 'Ingest customer email and route it with AI triage.',
    category: 'Email Automation',
    helper: 'Use a Gmail app password or delegated OAuth token.',
    fields: [
      { key: 'email', label: 'Inbox email', type: 'text', required: true },
      { key: 'app_password', label: 'App password', type: 'password', required: true, secret: true }
    ]
  },
  {
    key: 'outlook',
    name: 'Microsoft Outlook',
    description: 'Centralize shared mailboxes for automations.',
    category: 'Email Automation',
    helper: 'Use an Azure app password or delegated token.',
    fields: [
      { key: 'email', label: 'Mailbox email', type: 'text', required: true },
      { key: 'app_password', label: 'App password', type: 'password', required: true, secret: true }
    ]
  },
  {
    key: 'hubspot',
    name: 'HubSpot',
    description: 'Sync leads, deals, and lifecycle stages.',
    category: 'CRM',
    helper: 'Use a private app token with CRM scopes.',
    fields: [
      { key: 'access_token', label: 'Private app token', type: 'password', required: true, secret: true },
      { key: 'portal_id', label: 'Portal ID (optional)', type: 'text' }
    ]
  },
  {
    key: 'salesforce',
    name: 'Salesforce',
    description: 'Push qualified leads into Salesforce.',
    category: 'CRM',
    helper: 'Use a connected app client + refresh token.',
    fields: [
      { key: 'instance_url', label: 'Instance URL', type: 'text', required: true, placeholder: 'https://your-domain.my.salesforce.com' },
      { key: 'client_id', label: 'Client ID', type: 'text', required: true, secret: true },
      { key: 'client_secret', label: 'Client secret', type: 'password', required: true, secret: true },
      { key: 'refresh_token', label: 'Refresh token', type: 'password', required: true, secret: true }
    ]
  },
  {
    key: 'zoho',
    name: 'Zoho CRM',
    description: 'Update contacts, leads, and pipelines.',
    category: 'CRM',
    helper: 'Use OAuth client + refresh token.',
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', required: true, secret: true },
      { key: 'client_secret', label: 'Client secret', type: 'password', required: true, secret: true },
      { key: 'refresh_token', label: 'Refresh token', type: 'password', required: true, secret: true },
      { key: 'region', label: 'Region', type: 'select', options: ['us', 'eu', 'in', 'au', 'jp'] }
    ]
  },
  {
    key: 'intercom',
    name: 'Intercom',
    description: 'Route support conversations and tags.',
    category: 'Support',
    helper: 'Use a personal access token.',
    fields: [
      { key: 'access_token', label: 'Access token', type: 'password', required: true, secret: true },
      { key: 'workspace', label: 'Workspace name (optional)', type: 'text' }
    ]
  },
  {
    key: 'zendesk',
    name: 'Zendesk',
    description: 'Create and update support tickets automatically.',
    category: 'Support',
    helper: 'Use a Zendesk API token.',
    fields: [
      { key: 'subdomain', label: 'Subdomain', type: 'text', required: true, placeholder: 'acme' },
      { key: 'email', label: 'Agent email', type: 'text', required: true },
      { key: 'api_token', label: 'API token', type: 'password', required: true, secret: true }
    ]
  },
  {
    key: 'freshdesk',
    name: 'Freshdesk',
    description: 'Automate ticket intake and routing.',
    category: 'Support',
    helper: 'Use a Freshdesk API key.',
    fields: [
      { key: 'domain', label: 'Domain', type: 'text', required: true, placeholder: 'acme' },
      { key: 'api_key', label: 'API key', type: 'password', required: true, secret: true }
    ]
  },
  {
    key: 'twilio',
    name: 'Twilio',
    description: 'Send SMS and WhatsApp notifications.',
    category: 'Messaging',
    helper: 'Use a Twilio account SID and auth token.',
    fields: [
      { key: 'account_sid', label: 'Account SID', type: 'text', required: true, secret: true },
      { key: 'auth_token', label: 'Auth token', type: 'password', required: true, secret: true },
      { key: 'from_number', label: 'From number', type: 'text' }
    ]
  },
  {
    key: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'Automate messaging with WhatsApp Business API.',
    category: 'Messaging',
    helper: 'Use a WhatsApp Business access token.',
    fields: [
      { key: 'access_token', label: 'Access token', type: 'password', required: true, secret: true },
      { key: 'phone_number_id', label: 'Phone number ID', type: 'text', required: true }
    ]
  },
  {
    key: 'stripe',
    name: 'Stripe',
    description: 'Track revenue events and subscription status.',
    category: 'Revenue Ops',
    helper: 'Use a restricted Stripe secret key.',
    fields: [
      { key: 'secret_key', label: 'Secret key', type: 'password', required: true, secret: true },
      { key: 'webhook_secret', label: 'Webhook signing secret (optional)', type: 'password', secret: true }
    ]
  },
  {
    key: 'quickbooks',
    name: 'QuickBooks',
    description: 'Sync invoices, payments, and finance records.',
    category: 'Finance Ops',
    helper: 'Use OAuth client credentials and a refresh token.',
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', required: true, secret: true },
      { key: 'client_secret', label: 'Client secret', type: 'password', required: true, secret: true },
      { key: 'refresh_token', label: 'Refresh token', type: 'password', required: true, secret: true },
      { key: 'realm_id', label: 'Company/realm ID', type: 'text', required: true }
    ]
  },
  {
    key: 'razorpay',
    name: 'Razorpay',
    description: 'Automate payouts, invoices, and payment reconciliations.',
    category: 'Finance Ops',
    helper: 'Use Razorpay key ID and secret.',
    fields: [
      { key: 'key_id', label: 'Key ID', type: 'text', required: true, secret: true },
      { key: 'key_secret', label: 'Key secret', type: 'password', required: true, secret: true },
      { key: 'webhook_secret', label: 'Webhook secret (optional)', type: 'password', secret: true }
    ]
  },
  {
    key: 'shopify',
    name: 'Shopify',
    description: 'Connect orders, customers, and fulfillment signals.',
    category: 'Commerce Ops',
    helper: 'Use a private app access token.',
    fields: [
      { key: 'store_domain', label: 'Store domain', type: 'text', required: true, placeholder: 'yourstore.myshopify.com' },
      { key: 'access_token', label: 'Access token', type: 'password', required: true, secret: true }
    ]
  },
  {
    key: 'jira',
    name: 'Jira',
    description: 'Sync issues, incidents, and delivery workflows.',
    category: 'Project Ops',
    helper: 'Use Jira Cloud email + API token.',
    fields: [
      { key: 'base_url', label: 'Jira URL', type: 'text', required: true, placeholder: 'https://your-domain.atlassian.net' },
      { key: 'email', label: 'Account email', type: 'text', required: true },
      { key: 'api_token', label: 'API token', type: 'password', required: true, secret: true }
    ]
  },
  {
    key: 'clickup',
    name: 'ClickUp',
    description: 'Automate tasks, sprints, and delivery checklists.',
    category: 'Project Ops',
    helper: 'Use a ClickUp personal access token.',
    fields: [
      { key: 'access_token', label: 'Access token', type: 'password', required: true, secret: true },
      { key: 'workspace_id', label: 'Workspace ID (optional)', type: 'text' }
    ]
  },
  {
    key: 'hubspot_marketing',
    name: 'HubSpot Marketing',
    description: 'Sync campaigns, lifecycle stages, and marketing automation.',
    category: 'Marketing Ops',
    helper: 'Use a private app token with marketing scopes.',
    fields: [
      { key: 'access_token', label: 'Private app token', type: 'password', required: true, secret: true },
      { key: 'portal_id', label: 'Portal ID (optional)', type: 'text' }
    ]
  },
  {
    key: 'google_sheets',
    name: 'Google Sheets',
    description: 'Log leads, tickets, and automation runs.',
    category: 'Workflow Automation',
    helper: 'Use a service account JSON with Sheet access.',
    fields: [
      { key: 'sheet_id', label: 'Sheet ID', type: 'text', required: true, secret: true },
      { key: 'service_account_json', label: 'Service account JSON', type: 'textarea', required: true, secret: true }
    ]
  },
  {
    key: 'n8n',
    name: 'n8n',
    description: 'Trigger workflows inside n8n.',
    category: 'Workflow Automation',
    helper: 'Use a webhook URL and optional API key.',
    fields: [
      { key: 'webhook_url', label: 'Webhook URL', type: 'text', required: true, secret: true },
      { key: 'api_key', label: 'API key (optional)', type: 'password', secret: true }
    ]
  },
  {
    key: 'make',
    name: 'Make.com',
    description: 'Fan out automations across Make scenarios.',
    category: 'Workflow Automation',
    helper: 'Use the webhook URL from Make.com.',
    fields: [
      { key: 'webhook_url', label: 'Webhook URL', type: 'text', required: true, secret: true }
    ]
  }
];

export const businessCategories = [
  'Email Automation',
  'CRM',
  'Support',
  'Messaging',
  'Revenue Ops',
  'Finance Ops',
  'Commerce Ops',
  'Project Ops',
  'Marketing Ops',
  'Workflow Automation'
];
