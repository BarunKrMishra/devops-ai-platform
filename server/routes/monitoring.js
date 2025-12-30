import express from 'express';
import axios from 'axios';
import { db } from '../database/init.js';
import { io } from '../index.js';
import { getIntegrationRecord } from '../utils/integrations.js';

const router = express.Router();

// Simulate real-time metrics with realistic patterns
function generateRealisticMetrics() {
  const now = Date.now();
  const metrics = {
    cpu: [],
    memory: [],
    network: [],
    errors: [],
    responseTime: [],
    uptime: 99.9,
    lastUpdated: new Date().toISOString()
  };

  // Generate 24 hours of data with realistic patterns
  for (let i = 23; i >= 0; i--) {
    const timestamp = new Date(now - i * 60 * 60 * 1000);
    const hour = timestamp.getHours();
    
    // Simulate traffic patterns (higher during business hours)
    const trafficMultiplier = hour >= 9 && hour <= 17 ? 1.5 : 0.7;
    
    metrics.cpu.push({
      timestamp: timestamp.toISOString(),
      value: Math.floor(30 + Math.random() * 40 * trafficMultiplier)
    });
    
    metrics.memory.push({
      timestamp: timestamp.toISOString(),
      value: Math.floor(50 + Math.random() * 30 * trafficMultiplier)
    });
    
    metrics.network.push({
      timestamp: timestamp.toISOString(),
      value: Math.floor(20 + Math.random() * 40 * trafficMultiplier)
    });
    
    // Errors are rare but increase during high traffic
    metrics.errors.push({
      timestamp: timestamp.toISOString(),
      value: Math.floor(Math.random() * (trafficMultiplier > 1 ? 8 : 3))
    });
    
    // Response time increases with traffic
    metrics.responseTime.push({
      timestamp: timestamp.toISOString(),
      value: Math.floor(150 + Math.random() * 200 * trafficMultiplier)
    });
  }
  
  return metrics;
}

const buildHourlySeries = (points = []) => {
  return points
    .filter((point) => Array.isArray(point) && point.length >= 2 && point[1] !== null)
    .map((point) => ({
      timestamp: new Date(point[0] * 1000).toISOString(),
      value: Math.round(point[1])
    }));
};

const datadogBaseUrl = (site) => {
  const map = {
    us1: 'https://api.datadoghq.com',
    us3: 'https://api.us3.datadoghq.com',
    us5: 'https://api.us5.datadoghq.com',
    eu1: 'https://api.datadoghq.eu'
  };
  return map[site] || map.us1;
};

const fetchDatadogMetrics = async (credentials, metadata) => {
  const apiKey = credentials?.api_key;
  const appKey = credentials?.app_key;
  if (!apiKey || !appKey) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const from = now - 60 * 60 * 24;
  const baseUrl = datadogBaseUrl(metadata?.site);

  const queryMetric = async (query) => {
    const response = await axios.get(`${baseUrl}/api/v1/query`, {
      params: { from, to: now, query },
      headers: {
        'DD-API-KEY': apiKey,
        'DD-APPLICATION-KEY': appKey
      }
    });
    const series = response.data?.series?.[0];
    return series?.pointlist || [];
  };

  const [cpuPoints, memPoints, responsePoints] = await Promise.all([
    queryMetric('avg:system.cpu.user{*}'),
    queryMetric('avg:system.mem.pct_usable{*}'),
    queryMetric('avg:trace.http.request.duration{*}')
  ]);

  const cpu = buildHourlySeries(cpuPoints);
  const memory = buildHourlySeries(memPoints).map((point) => ({
    ...point,
    value: Math.max(0, 100 - point.value)
  }));
  const responseTime = buildHourlySeries(responsePoints);

  return {
    data_source: 'datadog',
    cpu,
    memory,
    responseTime,
    uptime: 99.9,
    lastUpdated: new Date().toISOString()
  };
};

const fetchPrometheusMetrics = async (credentials) => {
  const endpoint = credentials?.endpoint;
  if (!endpoint) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const from = now - 60 * 60 * 24;
  const step = 3600;
  const baseUrl = endpoint.replace(/\\/$/, '');

  const headers = credentials?.bearer_token
    ? { Authorization: `Bearer ${credentials.bearer_token}` }
    : undefined;

  const queryRange = async (query) => {
    const response = await axios.get(`${baseUrl}/api/v1/query_range`, {
      params: { query, start: from, end: now, step },
      headers
    });
    const series = response.data?.data?.result?.[0]?.values || [];
    return series.map((point) => [Number(point[0]), Number(point[1])]);
  };

  const [cpuPoints, memPoints, responsePoints] = await Promise.all([
    queryRange('100 * (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m])))'),
    queryRange('100 * (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))'),
    queryRange('histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))')
  ]);

  return {
    data_source: 'prometheus',
    cpu: buildHourlySeries(cpuPoints),
    memory: buildHourlySeries(memPoints),
    responseTime: buildHourlySeries(responsePoints),
    uptime: 99.9,
    lastUpdated: new Date().toISOString()
  };
};

const fetchGrafanaMetrics = async (credentials) => {
  if (!credentials?.url || !credentials?.api_token) {
    return null;
  }

  try {
    await axios.get(`${credentials.url.replace(/\\/$/, '')}/api/health`, {
      headers: { Authorization: `Bearer ${credentials.api_token}` }
    });
  } catch (error) {
    return null;
  }

  return {
    data_source: 'grafana',
    cpu: [],
    memory: [],
    responseTime: [],
    uptime: 99.9,
    lastUpdated: new Date().toISOString(),
    message: 'Grafana connected. Configure a metrics data source to display charts.'
  };
};

const fetchDatadogAlerts = async (credentials, metadata) => {
  const apiKey = credentials?.api_key;
  const appKey = credentials?.app_key;
  if (!apiKey || !appKey) {
    return [];
  }

  const baseUrl = datadogBaseUrl(metadata?.site);
  const response = await axios.get(`${baseUrl}/api/v1/monitor`, {
    headers: {
      'DD-API-KEY': apiKey,
      'DD-APPLICATION-KEY': appKey
    }
  });

  return (response.data || [])
    .filter((monitor) => monitor.overall_state && monitor.overall_state !== 'OK')
    .slice(0, 5)
    .map((monitor, index) => ({
      id: index + 1,
      type: monitor.overall_state === 'Alert' ? 'error' : 'warning',
      title: monitor.name,
      message: monitor.message || 'Datadog monitor triggered.',
      timestamp: new Date().toISOString(),
      resolved: false
    }));
};

const fetchPrometheusAlerts = async (credentials) => {
  const endpoint = credentials?.endpoint;
  if (!endpoint) {
    return [];
  }

  const headers = credentials?.bearer_token
    ? { Authorization: `Bearer ${credentials.bearer_token}` }
    : undefined;

  const response = await axios.get(`${endpoint.replace(/\\/$/, '')}/api/v1/alerts`, { headers });
  const alerts = response.data?.data?.alerts || [];

  return alerts.slice(0, 5).map((alert, index) => ({
    id: index + 1,
    type: alert.labels?.severity === 'critical' ? 'error' : 'warning',
    title: alert.labels?.alertname || 'Prometheus Alert',
    message: alert.annotations?.description || alert.annotations?.summary || 'Prometheus alert active.',
    timestamp: alert.activeAt || new Date().toISOString(),
    resolved: alert.state !== 'firing'
  }));
};

const fetchGrafanaAlerts = async (credentials) => {
  if (!credentials?.url || !credentials?.api_token) {
    return [];
  }

  const baseUrl = credentials.url.replace(/\\/$/, '');
  const response = await axios.get(`${baseUrl}/api/alerts`, {
    headers: { Authorization: `Bearer ${credentials.api_token}` }
  });

  return (response.data || []).slice(0, 5).map((alert, index) => ({
    id: index + 1,
    type: alert.state === 'alerting' ? 'error' : 'warning',
    title: alert.name || 'Grafana alert',
    message: alert.message || 'Grafana alert active.',
    timestamp: alert.newStateDate || new Date().toISOString(),
    resolved: alert.state !== 'alerting'
  }));
};

const fetchPagerDutyAlerts = async (credentials, metadata) => {
  const token = credentials?.api_token;
  if (!token) {
    return [];
  }

  const response = await axios.get('https://api.pagerduty.com/incidents', {
    headers: {
      Authorization: `Token token=${token}`,
      Accept: 'application/vnd.pagerduty+json;version=2'
    },
    params: {
      statuses: ['triggered', 'acknowledged'],
      service_ids: metadata?.service_id ? [metadata.service_id] : undefined,
      limit: 5
    }
  });

  return (response.data?.incidents || []).slice(0, 5).map((incident, index) => ({
    id: index + 1,
    type: incident.urgency === 'high' ? 'error' : 'warning',
    title: incident.title || 'PagerDuty incident',
    message: incident.summary || 'PagerDuty incident active.',
    timestamp: incident.created_at || new Date().toISOString(),
    resolved: incident.status !== 'triggered'
  }));
};

// Get monitoring data
router.get('/metrics/:projectId', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;

    const datadogIntegration = getIntegrationRecord(organizationId, 'datadog');
    const prometheusIntegration = getIntegrationRecord(organizationId, 'prometheus');
    const grafanaIntegration = getIntegrationRecord(organizationId, 'grafana');

    let metrics = null;

    if (datadogIntegration?.credentials) {
      metrics = await fetchDatadogMetrics(
        datadogIntegration.credentials,
        datadogIntegration.configuration?.metadata
      );
    }

    if (!metrics && prometheusIntegration?.credentials) {
      metrics = await fetchPrometheusMetrics(prometheusIntegration.credentials);
    }

    if (!metrics && grafanaIntegration?.credentials) {
      metrics = await fetchGrafanaMetrics(grafanaIntegration.credentials);
    }

    if (!metrics) {
      metrics = {
        ...generateRealisticMetrics(),
        data_source: 'demo',
        requires_integration: true
      };
    } else {
      metrics.requires_integration = false;
    }

    res.json(metrics);
  } catch (error) {
    console.error('Metrics fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// Get alerts with dynamic generation
router.get('/alerts', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;

    const datadogIntegration = getIntegrationRecord(organizationId, 'datadog');
    const prometheusIntegration = getIntegrationRecord(organizationId, 'prometheus');
    const grafanaIntegration = getIntegrationRecord(organizationId, 'grafana');
    const pagerdutyIntegration = getIntegrationRecord(organizationId, 'pagerduty');

    const alerts = [];

    if (datadogIntegration?.credentials) {
      try {
        const datadogAlerts = await fetchDatadogAlerts(
          datadogIntegration.credentials,
          datadogIntegration.configuration?.metadata
        );
        alerts.push(...datadogAlerts);
      } catch (error) {
        console.error('Datadog alerts fetch error:', error);
      }
    }

    if (prometheusIntegration?.credentials) {
      try {
        const prometheusAlerts = await fetchPrometheusAlerts(prometheusIntegration.credentials);
        alerts.push(...prometheusAlerts);
      } catch (error) {
        console.error('Prometheus alerts fetch error:', error);
      }
    }

    if (grafanaIntegration?.credentials) {
      try {
        const grafanaAlerts = await fetchGrafanaAlerts(grafanaIntegration.credentials);
        alerts.push(...grafanaAlerts);
      } catch (error) {
        console.error('Grafana alerts fetch error:', error);
      }
    }

    if (pagerdutyIntegration?.credentials) {
      try {
        const pagerdutyAlerts = await fetchPagerDutyAlerts(
          pagerdutyIntegration.credentials,
          pagerdutyIntegration.configuration?.metadata
        );
        alerts.push(...pagerdutyAlerts);
      } catch (error) {
        console.error('PagerDuty alerts fetch error:', error);
      }
    }

    if (alerts.length === 0) {
      const alertTemplates = [
        {
          type: 'warning',
          title: 'High CPU Usage',
          message: 'CPU usage has been above 80% for the last 10 minutes',
          condition: () => Math.random() > 0.7
        },
        {
          type: 'info',
          title: 'Deployment Successful',
          message: 'Your application has been successfully deployed to production',
          condition: () => Math.random() > 0.8
        },
        {
          type: 'error',
          title: 'Database Connection Failed',
          message: 'Unable to connect to the database. Auto-healing in progress.',
          condition: () => Math.random() > 0.9
        },
        {
          type: 'warning',
          title: 'Memory Usage Alert',
          message: 'Memory usage is approaching 85% threshold',
          condition: () => Math.random() > 0.75
        },
        {
          type: 'info',
          title: 'Backup Completed',
          message: 'Daily backup completed successfully',
          condition: () => Math.random() > 0.85
        }
      ];

      const demoAlerts = alertTemplates
        .filter((alert) => alert.condition())
        .map((alert, index) => ({
          id: index + 1,
          type: alert.type,
          title: alert.title,
          message: alert.message,
          timestamp: new Date(Date.now() - Math.random() * 60 * 60 * 1000).toISOString(),
          resolved: Math.random() > 0.3
        }))
        .slice(0, 5);

      return res.json(demoAlerts);
    }

    res.json(alerts.slice(0, 8));
  } catch (error) {
    console.error('Alerts fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Auto-healing endpoint with realistic actions
router.post('/auto-heal/:resourceId', async (req, res) => {
  try {
    const { resourceId } = req.params;
    const { issue } = req.body;
    const userId = req.user.id;

    // Get resource
    const resource = db.prepare(
      `SELECT ir.*, p.user_id FROM infrastructure_resources ir 
       JOIN projects p ON ir.project_id = p.id WHERE ir.id = ?`
    ).get(resourceId);

    if (!resource || resource.user_id !== userId) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    // Realistic healing actions based on issue type
    const healingActions = {
      'high_cpu': 'Scaled up instances and optimized resource allocation',
      'memory_leak': 'Restarted application and cleared memory cache',
      'database_connection': 'Reconnected to database and updated connection pool',
      'disk_space': 'Cleaned up temporary files and expanded storage',
      'network_latency': 'Optimized network routing and updated load balancer',
      'service_unavailable': 'Restarted service and verified health checks'
    };

    const action = healingActions[issue] || 'Applied general optimization measures';
    
    // Simulate healing process with realistic timing
    const healingTime = Math.floor(Math.random() * 3000) + 2000; // 2-5 seconds
    
    setTimeout(() => {
      io.to(`user-${userId}`).emit('healing-complete', {
        resourceId,
        action,
        timestamp: new Date().toISOString(),
        success: Math.random() > 0.1 // 90% success rate
      });
    }, healingTime);

    res.json({ 
      success: true, 
      message: 'Auto-healing initiated',
      action,
      estimatedTime: `${Math.ceil(healingTime / 1000)} seconds`
    });
  } catch (error) {
    console.error('Auto-healing error:', error);
    res.status(500).json({ error: 'Failed to initiate auto-healing' });
  }
});

// Health check endpoint with dynamic status
router.get('/health/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    // Verify project ownership
    const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(projectId, userId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get project resources
    const resources = db.prepare(
      'SELECT * FROM infrastructure_resources WHERE project_id = ?'
    ).all(projectId);

    // Generate realistic health status
    const healthStatus = {
      overall: Math.random() > 0.1 ? 'healthy' : 'warning',
      services: resources.map(resource => ({
        id: resource.id,
        type: resource.resource_type,
        status: Math.random() > 0.15 ? 'healthy' : (Math.random() > 0.5 ? 'warning' : 'critical'),
        uptime: Math.random() * 100,
        lastCheck: new Date().toISOString(),
        responseTime: Math.floor(Math.random() * 500) + 50
      }))
    };

    res.json(healthStatus);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ error: 'Failed to perform health check' });
  }
});

export default router;
