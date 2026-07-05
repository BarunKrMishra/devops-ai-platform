import { createOpsService } from '../_shared/createOpsService.js';

createOpsService({
  key: 'ops-marketing',
  name: 'Marketing Ops',
  description: 'Campaign automation and lifecycle orchestration with AI insight.',
  defaultPort: 4015,
  integrations: [
    'HubSpot Marketing'
  ]
});
