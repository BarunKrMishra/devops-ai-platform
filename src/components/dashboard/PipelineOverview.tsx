import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { GitBranch, CheckCircle, Clock, AlertTriangle, Play } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import SkeletonBlock from '../ui/SkeletonBlock';
import EmptyState from '../ui/EmptyState';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type Pipeline = {
  id: number | string;
  name: string;
  repository_url?: string;
  status: string;
  framework?: string;
  cloud_provider?: string;
  source?: string;
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'success':
      return <CheckCircle className="h-5 w-5 text-green-400" />;
    case 'running':
      return <Clock className="h-5 w-5 text-teal-400 animate-spin" />;
    case 'failed':
      return <AlertTriangle className="h-5 w-5 text-red-400" />;
    default:
      return <Clock className="h-5 w-5 text-slate-400" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'success':
      return 'bg-green-500/20 text-green-300 border-green-500/30';
    case 'running':
      return 'bg-teal-500/20 text-teal-300 border-teal-500/30';
    case 'failed':
      return 'bg-red-500/20 text-red-300 border-red-500/30';
    default:
      return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  }
};

const PipelineOverview: React.FC = () => {
  const { token } = useAuth();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsModule, setNeedsModule] = useState(false);

  useEffect(() => {
    const fetchPipelines = async () => {
      if (!token) {
        setLoading(false);
        setError('Log in to view pipelines.');
        return;
      }
      setError('');
      setNeedsModule(false);
      try {
        const { data } = await axios.get<Pipeline[]>(`${API_URL}/api/cicd/pipelines`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPipelines(Array.isArray(data) ? data : []);
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 403) {
          setNeedsModule(true);
        } else {
          setError('Unable to load pipeline data.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPipelines();
  }, [token]);

  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonBlock className="h-10" />
        {Array.from({ length: 3 }).map((_, idx) => (
          <SkeletonBlock key={idx} className="h-20" />
        ))}
      </div>
    );
  }

  if (needsModule) {
    return (
      <EmptyState
        title="Enable the AI DevOps module"
        message="Turn on the AI DevOps suite in the Ops Hub to view CI/CD pipelines here."
        icon={GitBranch}
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

  if (pipelines.length === 0) {
    return (
      <EmptyState
        title="No pipelines yet"
        message="Connect GitHub, GitLab or Jenkins (or create a project) to see live CI/CD pipelines."
        icon={GitBranch}
      />
    );
  }

  const successful = pipelines.filter((p) => p.status === 'success').length;
  const running = pipelines.filter((p) => p.status === 'running').length;
  const failed = pipelines.filter((p) => p.status === 'failed').length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-slate-400">Total pipelines</p>
          <p className="text-2xl font-semibold text-white">{pipelines.length}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-xs text-green-300">Successful</p>
          <p className="text-2xl font-semibold text-white">{successful}</p>
        </div>
        <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-4">
          <p className="text-xs text-teal-300">Running</p>
          <p className="text-2xl font-semibold text-white">{running}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-xs text-red-300">Failed</p>
          <p className="text-2xl font-semibold text-white">{failed}</p>
        </div>
      </div>

      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h3 className="text-xl font-semibold text-white mb-1">Recent pipelines</h3>
          <p className="text-slate-400 text-sm">Live status from your connected sources.</p>
        </div>

        <div className="divide-y divide-white/10">
          {pipelines.map((pipeline) => (
            <div key={pipeline.id} className="p-6 hover:bg-white/5 transition-colors">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center space-x-4 min-w-0">
                  {getStatusIcon(pipeline.status)}
                  <div className="min-w-0">
                    <h4 className="font-semibold text-white truncate">{pipeline.name}</h4>
                    <div className="flex items-center space-x-3 text-sm text-slate-400 mt-1">
                      <span className="inline-flex items-center space-x-1">
                        <GitBranch className="h-4 w-4" />
                        <span>{pipeline.framework || pipeline.source || 'pipeline'}</span>
                      </span>
                      {pipeline.cloud_provider && (
                        <>
                          <span>-</span>
                          <span>{pipeline.cloud_provider}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(pipeline.status)}`}>
                    {pipeline.status}
                  </span>
                  {pipeline.repository_url && (
                    <a
                      href={pipeline.repository_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      aria-label="Open repository"
                    >
                      <Play className="h-4 w-4 text-slate-400" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PipelineOverview;
