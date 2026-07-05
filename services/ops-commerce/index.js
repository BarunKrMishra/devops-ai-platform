import { createOpsService } from '../_shared/createOpsService.js';

createOpsService({
  key: 'ops-commerce',
  name: 'Commerce Ops',
  description: 'Storefront automation for orders, inventory, and fulfillment with AI insights.',
  defaultPort: 4012,
  integrations: [
    'Shopify'
  ]
});
