import { createOpsService } from '../_shared/createOpsService.js';

createOpsService({
  key: 'ops-finance',
  name: 'Finance Ops',
  description: 'Billing, invoicing, and payout workflows with AI validation.',
  defaultPort: 4013,
  integrations: [
    'QuickBooks',
    'Razorpay',
    'Stripe'
  ]
});
