import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Server, Database, Cloud, DollarSign } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import SkeletonBlock from '../ui/SkeletonBlock';
import EmptyState from '../ui/EmptyState';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type Overview = {
  requires_integration?: boolean;
  data_source?: string;
  region?: string;
  totalInstances?: number;
  totalDatabases?: number;
  monthlyCost?: number;
};

type Resource = {
  id: number | string;
  name: string;
  type: string;
  provider?: string;
  region?: string;
  regionName?: string;
  status: string;
  cost?: number;
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'running':
      return 'text-green-400 bg-green-500/20 border-green-500/30';
    case 'stopped':
      return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
    case 'terminated':
      return 'text-red-400 bg-red-500/20 border-red-500/30';
    default:
      return 'text-slate-400 bg-slate-500/20 border-slate-500/30';
  }
};

const InfrastructureMap: React.FC = () => {
  const { token } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsModule, setNeedsModule] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) {
        setLoading(false);
        setError('Log in to view infrastructure.');
        return;
      }
      setError('');
      setNeedsModule(false);
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [overviewRes, resourcesRes] = await Promise.all([
          axios.get<Overview>(`${API_URL}/api/infrastructure/overview`, { headers }),
          axios.get<{ resources?: Resource[] }>(`${API_URL}/api/infrastructure/resources`, { headers })
        ]);
        setOverview(overviewRes.data || {});
        setResources(resourcesRes.data?.resources || []);
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 403) {
          setNeedsModule(true);
        } else {
          setError('Unable to load infrastructure data.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, idx) => (
            <SkeletonBlock key={idx} className="h-20" />
          ))}
        </div>
        <SkeletonBlock className="h-40" />
      </div>
    );
  }

  if (needsModule) {
    return (
      <EmptyState
        title="Enable the AI DevOps module"
        message="Turn on the AI DevOps suite in the Ops Hub to view infrastructure here."
        icon={Server}
      />
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        {error}
      </div>
    );
  }

  if (overview?.requires_integration) {
    return (
      <EmptyState
        title="Connect a cloud account"
        message="Connect AWS to see live instances, databases and spend across your regions."
        icon={Cloud}
      />
    );
  }

  const regionGroups = resources.reduce<Record<string, Resource[]>>((acc, resource) => {
    const key = resource.regionName || resource.region || 'Unknown region';
    (acc[key] = acc[key] || []).push(resource);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-teal-400 text-sm font-medium">Total instances</span>
            <Server className="h-5 w-5 text-teal-400" />
          </div>
          <div className="text-2xl font-bold text-white">{overview?.totalInstances ?? 0}</div>
          <div className="text-xs text-teal-300">{overview?.region || overview?.data_source || 'connected'}</div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-amber-400 text-sm font-medium">Databases</span>
            <Database className="h-5 w-5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white">{overview?.totalDatabases ?? 0}</div>
          <div className="text-xs text-amber-300">Managed instances</div>
        </div>

        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-green-400 text-sm font-medium">Est. monthly cost</span>
            <DollarSign className="h-5 w-5 text-green-400" />
          </div>
          <div className="text-2xl font-bold text-white">${overview?.monthlyCost ?? 0}</div>
          <div className="text-xs text-green-300">Based on current usage</div>
        </div>
      </div>

      {Object.keys(regionGroups).length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
          No resources reported for this account yet.
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(regionGroups).map(([regionName, regionResources]) => (
            <div key={regionName} className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
              <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
                <h3 className="font-semibold text-white">{regionName}</h3>
                <span className="text-sm text-slate-400">{regionResources.length} resources</span>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {regionResources.map((resource) => (
                  <div key={resource.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs uppercase tracking-wide text-slate-400">{resource.type}</span>
                      <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(resource.status)}`}>
                        {resource.status}
                      </span>
                    </div>
                    <h4 className="font-medium text-white text-sm truncate">{resource.name}</h4>
                    {typeof resource.cost === 'number' && (
                      <p className="text-xs text-slate-400 mt-1">${resource.cost}/mo</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InfrastructureMap;
