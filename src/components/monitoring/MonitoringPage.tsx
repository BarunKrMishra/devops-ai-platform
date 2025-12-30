import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, CheckCircle, Clock, Zap, Shield, Sparkles } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import EmptyState from '../ui/EmptyState';
import SkeletonBlock from '../ui/SkeletonBlock';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Alert {
  id: number;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  resolved: boolean;
}

interface Metric {
  timestamp: string;
  value: number;
}

const MonitoringPage: React.FC = () => {
  const { onboarding, token } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [metrics, setMetrics] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [selectedProject] = useState(1);
  const [requiresIntegration, setRequiresIntegration] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [channels, setChannels] = useState<{ slack?: string; pagerduty?: string }>({});
  const showDemoData = onboarding?.demo_mode !== false;

  useEffect(() => {
    fetchMonitoringData();
    const interval = setInterval(fetchMonitoringData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [selectedProject, showDemoData, token]);

  const fetchMonitoringData = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoadError('');
    try {
      const [alertsRes, metricsRes, integrationsRes] = await Promise.all([
        axios.get(`${API_URL}/api/monitoring/alerts`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/api/monitoring/metrics/${selectedProject}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/api/integrations`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      setAlerts(alertsRes.data);
      setMetrics(metricsRes.data);
      setRequiresIntegration(Boolean(metricsRes.data?.requires_integration));
      const list = Array.isArray(integrationsRes.data) ? integrationsRes.data : [];
      const slack = list.find((item: any) => item.type === 'slack' && item.is_active);
      const pagerduty = list.find((item: any) => item.type === 'pagerduty' && item.is_active);
      setChannels({
        slack: slack?.configuration?.metadata?.workspace || slack?.name,
        pagerduty: pagerduty?.configuration?.metadata?.service_id || pagerduty?.name
      });
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error);
      setLoadError('Unable to load monitoring data. Check your monitoring integrations and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoHeal = async (resourceId: number, issue: string) => {
    try {
      await axios.post(
        `${API_URL}/api/monitoring/auto-heal/${resourceId}`,
        { issue },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Refresh data after healing
      setTimeout(fetchMonitoringData, 3000);
    } catch (error) {
      console.error('Auto-healing failed:', error);
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-400" />;
      case 'warning':
        return <Clock className="h-5 w-5 text-yellow-400" />;
      case 'info':
        return <CheckCircle className="h-5 w-5 text-teal-400" />;
      default:
        return <Activity className="h-5 w-5 text-slate-400" />;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'bg-red-500/20 border-red-500/30';
      case 'warning':
        return 'bg-yellow-500/20 border-yellow-500/30';
      case 'info':
        return 'bg-teal-500/20 border-teal-500/30';
      default:
        return 'bg-slate-500/20 border-slate-500/30';
    }
  };

  if (loading) {
    return (
      <div className="pt-20 min-h-screen bg-aikya">
        <div className="container mx-auto px-6 py-8 space-y-6">
          <SkeletonBlock className="h-16" />
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <SkeletonBlock key={idx} className="h-28" />
            ))}
          </div>
          <SkeletonBlock className="h-64" />
        </div>
      </div>
    );
  }

  if (!showDemoData && requiresIntegration) {
    return (
      <div className="pt-20 min-h-screen bg-aikya">
        <div className="container mx-auto px-6 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Monitoring & Auto-Healing</h1>
            <p className="text-slate-400">Live monitoring data will appear once integrations are connected.</p>
          </div>
          <EmptyState
            title="Waiting for live monitoring data"
            message="Connect your monitoring stack or include data sources in the go-live request to begin streaming alerts."
            icon={Sparkles}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 min-h-screen bg-aikya">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Monitoring & Auto-Healing</h1>
          <p className="text-slate-400">Real-time monitoring with AI-powered incident response</p>
        </div>

        {loadError && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {loadError}
          </div>
        )}
        {metrics?.message && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {metrics.message}
          </div>
        )}

        {(channels.slack || channels.pagerduty) && (
          <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 px-6 py-4">
            <h2 className="text-sm font-semibold text-white">Alert channels connected</h2>
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-300">
              {channels.slack && (
                <span className="rounded-full bg-white/10 px-3 py-1">Slack: {channels.slack}</span>
              )}
              {channels.pagerduty && (
                <span className="rounded-full bg-white/10 px-3 py-1">PagerDuty: {channels.pagerduty}</span>
              )}
            </div>
          </div>
        )}

        {/* Metrics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <Activity className="h-8 w-8 text-teal-400" />
              <span className="text-2xl font-bold text-white">{metrics.cpu?.slice(-1)[0]?.value || 0}%</span>
            </div>
            <h3 className="text-teal-400 font-medium">CPU Usage</h3>
            <p className="text-xs text-slate-400 mt-1">Current average</p>
          </div>

          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <Activity className="h-8 w-8 text-green-400" />
              <span className="text-2xl font-bold text-white">{metrics.memory?.slice(-1)[0]?.value || 0}%</span>
            </div>
            <h3 className="text-green-400 font-medium">Memory Usage</h3>
            <p className="text-xs text-slate-400 mt-1">Current average</p>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <Shield className="h-8 w-8 text-amber-400" />
              <span className="text-2xl font-bold text-white">{metrics.uptime || 99.9}%</span>
            </div>
            <h3 className="text-amber-400 font-medium">Uptime</h3>
            <p className="text-xs text-slate-400 mt-1">Last 30 days</p>
          </div>

          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <Clock className="h-8 w-8 text-orange-400" />
              <span className="text-2xl font-bold text-white">{metrics.responseTime?.slice(-1)[0]?.value || 0}ms</span>
            </div>
            <h3 className="text-orange-400 font-medium">Response Time</h3>
            <p className="text-xs text-slate-400 mt-1">Average</p>
          </div>
        </div>

        {/* Alerts Section */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Active Alerts</h2>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-green-400">AI Monitoring Active</span>
            </div>
          </div>

          <div className="space-y-4">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border ${getAlertColor(alert.type)} ${
                  alert.resolved ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    {getAlertIcon(alert.type)}
                    <div>
                      <h3 className="font-semibold text-white">{alert.title}</h3>
                      <p className="text-slate-300 text-sm mt-1">{alert.message}</p>
                      <p className="text-xs text-slate-500 mt-2">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {alert.resolved ? (
                      <span className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-xs">
                        Resolved
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAutoHeal(1, 'high_cpu')}
                        className="flex items-center space-x-1 px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs hover:bg-amber-500/30 transition-colors"
                      >
                        <Zap className="h-3 w-3" />
                        <span>Auto-Heal</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Metrics Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">CPU Usage (24h)</h3>
            <div className="h-48 flex items-end justify-between space-x-1">
              {metrics.cpu?.map((point: Metric, index: number) => (
                <div
                  key={index}
                  className="bg-teal-500 rounded-t flex-1"
                  style={{ height: `${(point.value / 100) * 100}%` }}
                  title={`${point.value}% at ${new Date(point.timestamp).toLocaleTimeString()}`}
                ></div>
              ))}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Memory Usage (24h)</h3>
            <div className="h-48 flex items-end justify-between space-x-1">
              {metrics.memory?.map((point: Metric, index: number) => (
                <div
                  key={index}
                  className="bg-green-500 rounded-t flex-1"
                  style={{ height: `${(point.value / 100) * 100}%` }}
                  title={`${point.value}% at ${new Date(point.timestamp).toLocaleTimeString()}`}
                ></div>
              ))}
            </div>
          </div>
        </div>

        {/* Auto-Healing Status */}
        <div className="mt-8 bg-gradient-to-r from-amber-500/10 to-teal-500/10 rounded-xl p-6 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">AI Auto-Healing Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">12</div>
              <p className="text-sm text-slate-400">Issues Resolved</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-teal-400">3.2s</div>
              <p className="text-sm text-slate-400">Avg Response Time</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-400">99.8%</div>
              <p className="text-sm text-slate-400">Success Rate</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonitoringPage;
