import { createOpsService } from '../_shared/createOpsService.js';

createOpsService({
  key: 'ops-project',
  name: 'Project Ops',
  description: 'Delivery and execution workflows powered by AI prioritization.',
  defaultPort: 4014,
  integrations: [
    'Jira',
    'ClickUp'
  ]
});
