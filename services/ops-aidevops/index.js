import { createOpsService } from '../_shared/createOpsService.js';

createOpsService({
  key: 'ops-aidevops',
  name: 'AI DevOps Ops',
  description: 'AI-first DevOps automation for CI/CD, infrastructure, and monitoring.',
  defaultPort: 4010,
  integrations: [
    'GitHub',
    'GitLab',
    'Jenkins',
    'AWS',
    'Azure',
    'GCP',
    'Datadog',
    'Grafana',
    'Prometheus'
  ]
});
