import { sequelize } from './sequelize.js';
import { OpsModule } from '../models/index.js';
import { runMigrations } from './migrate.js';

export const connectDatabase = async () => {
  // Retry with backoff so a not-yet-ready database (common on container
  // platforms where the DB and app boot together) doesn't hard-crash the
  // process before it can serve the health check. console.error is used
  // because console.log/info are silenced in production (see config/env.js).
  const maxAttempts = 10;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await sequelize.authenticate();
      if (attempt > 1) {
        console.error(`[db] connected on attempt ${attempt}`);
      }
      return sequelize;
    } catch (error) {
      lastError = error;
      console.error(`[db] connection attempt ${attempt}/${maxAttempts} failed: ${error.message}`);
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(attempt * 2000, 10000)));
      }
    }
  }
  console.error('[db] all connection attempts exhausted. Check MYSQL_URL / MYSQL_* and that the database service is reachable.');
  throw lastError;
};

export const seedOpsModules = async () => {
  const count = await OpsModule.count();
  if (count > 0) {
    return;
  }

  await OpsModule.bulkCreate([
    {
      key: 'aidevops',
      name: 'AI DevOps',
      category: 'Engineering',
      description: 'CI/CD, infrastructure, monitoring, and automated remediation with AI copilots.',
      metadata: {
        launch_path: '/ops/aidevops',
        integrations: ['GitHub', 'GitLab', 'Jenkins', 'AWS', 'Azure', 'GCP', 'Datadog', 'Grafana', 'Prometheus']
      }
    },
    {
      key: 'businessops',
      name: 'Business Ops',
      category: 'Operations',
      description: 'Automate email triage, CRM updates, lead scoring, and customer workflows.',
      metadata: {
        launch_path: '/business',
        integrations: ['Gmail', 'Outlook', 'HubSpot', 'Salesforce', 'Zoho', 'Intercom', 'Zendesk', 'Freshdesk']
      }
    },
    {
      key: 'commerceops',
      name: 'Commerce Ops',
      category: 'Commerce',
      description: 'Sync storefront operations, orders, and inventory signals with AI automation.',
      metadata: {
        launch_path: '/ops/commerceops',
        integrations: ['Shopify']
      }
    },
    {
      key: 'financeops',
      name: 'Finance Ops',
      category: 'Finance',
      description: 'Automate billing, payouts, and finance workflows with AI validation.',
      metadata: {
        launch_path: '/ops/financeops',
        integrations: ['QuickBooks', 'Razorpay', 'Stripe']
      }
    },
    {
      key: 'projectops',
      name: 'Project Ops',
      category: 'Project Management',
      description: 'Keep delivery, tickets, and execution aligned with AI-prioritized ops.',
      metadata: {
        launch_path: '/ops/projectops',
        integrations: ['Jira', 'ClickUp']
      }
    },
    {
      key: 'marketingops',
      name: 'Marketing Ops',
      category: 'Marketing',
      description: 'Automate campaigns, lifecycle triggers, and attribution with AI insights.',
      metadata: {
        launch_path: '/ops/marketingops',
        integrations: ['HubSpot Marketing']
      }
    }
  ]);
};

export const initializeDatabase = async () => {
  await connectDatabase();
  await runMigrations();
  await seedOpsModules();
};
