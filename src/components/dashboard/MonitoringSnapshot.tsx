import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Activity, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import SkeletonBlock from '../ui/SkeletonBlock';
import EmptyState from '../ui/EmptyState';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type Alert = {
  id: number;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  resolved: boolean;
};

const MonitoringSnapshot: React.FC = () => {
  const { token } = useAuth();
  const [metrics, setMetrics] = useState<any>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!token) {
        setLoading(false);
        setError('Log in to view monitoring data.');
        return;
      }

      setError('');
      try {
        const [alertsRes, metricsRes] = await Promise.all([
          axios.get(`${API_URL}/api/monitoring/alerts`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get(`${API_URL}/api/monitoring/metrics/1`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        setAlerts(alertsRes.data || []);
        setMetrics(metricsRes.data || {});
      } catch (err) {
        console.error('Dashboard monitoring fetch error:', err);
        setError('Unable to load live monitoring data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonBlock className="h-10" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <SkeletonBlock key={idx} className="h-20" />
          ))}
        </div>
        <SkeletonBlock className="h-32" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        {error}
      </div>
    );
  }

  if (metrics?.requires_integration) {
    return (
      <EmptyState
        title="Connect monitoring to view live metrics"
        message="Connect Datadog or Prometheus to populate live metrics on the dashboard."
        icon={Activity}
      />
    );
  }

  if (metrics?.data_available === false) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {metrics.message || 'Monitoring source connected, but no data is flowing yet.'}
        </div>
        {metrics.guidance && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
            {metrics.guidance}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-teal-500/20 bg-teal-500/10 p-4">
          <p className="text-xs text-teal-200">CPU</p>
          <p className="text-2xl font-semibold text-white">{metrics?.cpu?.slice(-1)[0]?.value || 0}%</p>
        </div>
        <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4">
          <p className="text-xs text-green-200">Memory</p>
          <p className="text-2xl font-semibold text-white">{metrics?.memory?.slice(-1)[0]?.value || 0}%</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
          <p className="text-xs text-amber-200">Uptime</p>
          <p className="text-2xl font-semibold text-white">{metrics?.uptime || 99.9}%</p>
        </div>
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-4">
          <p className="text-xs text-orange-200">Response</p>
          <p className="text-2xl font-semibold text-white">{metrics?.responseTime?.slice(-1)[0]?.value || 0}ms</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Latest alerts</h3>
          <span className="text-xs text-slate-400">Data source: {metrics?.data_source || 'live'}</span>
        </div>
        <div className="mt-3 space-y-2">
          {alerts.slice(0, 3).map((alert) => (
            <div key={alert.id} className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="flex items-start gap-2">
                {alert.type === 'error' ? (
                  <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5" />
                ) : alert.type === 'warning' ? (
                  <Clock className="h-4 w-4 text-amber-400 mt-0.5" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-teal-400 mt-0.5" />
                )}
                <div>
                  <p className="text-sm text-white">{alert.title}</p>
                  <p className="text-xs text-slate-400">{alert.message}</p>
                </div>
              </div>
              <span className="text-xs text-slate-500">
                {new Date(alert.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
          {alerts.length === 0 && (
            <p className="text-sm text-slate-400">No active alerts right now.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MonitoringSnapshot;
