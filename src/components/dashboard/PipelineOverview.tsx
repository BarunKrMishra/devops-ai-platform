import React from 'react';
import { GitBranch, CheckCircle, Clock, AlertTriangle, Play, Pause } from 'lucide-react';

const PipelineOverview: React.FC = () => {
  const pipelines = [
    {
      id: 1,
      name: 'React Dashboard App',
      branch: 'main',
      status: 'success',
      lastRun: '2 minutes ago',
      duration: '3m 42s',
      environment: 'production',
      commits: 3
    },
    {
      id: 2,
      name: 'API Gateway Service',
      branch: 'develop',
      status: 'running',
      lastRun: 'Running now',
      duration: '1m 23s',
      environment: 'staging',
      commits: 1
    },
    {
      id: 3,
      name: 'Authentication Service',
      branch: 'feature/oauth',
      status: 'failed',
      lastRun: '1 hour ago',
      duration: '2m 15s',
      environment: 'development',
      commits: 2
    }
  ];

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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-green-400 text-sm font-medium">Successful Deployments</span>
            <CheckCircle className="h-5 w-5 text-green-400" />
          </div>
          <div className="text-2xl font-bold text-white">127</div>
          <div className="text-xs text-green-300">+12% this week</div>
        </div>

        <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-teal-400 text-sm font-medium">Active Pipelines</span>
            <Play className="h-5 w-5 text-teal-400" />
          </div>
          <div className="text-2xl font-bold text-white">8</div>
          <div className="text-xs text-teal-300">2 running now</div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-amber-400 text-sm font-medium">Avg. Deploy Time</span>
            <Clock className="h-5 w-5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white">2m 45s</div>
          <div className="text-xs text-amber-300">-30s from last week</div>
        </div>

        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-orange-400 text-sm font-medium">Cost Savings</span>
            <span className="text-orange-400 text-lg">$</span>
          </div>
          <div className="text-2xl font-bold text-white">$2,340</div>
          <div className="text-xs text-orange-300">This month</div>
        </div>
      </div>

      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h3 className="text-xl font-semibold text-white mb-2">Recent Pipelines</h3>
          <p className="text-slate-400">Monitor and manage your CI/CD pipelines</p>
        </div>

        <div className="divide-y divide-white/10">
          {pipelines.map((pipeline) => (
            <div key={pipeline.id} className="p-6 hover:bg-white/5 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {getStatusIcon(pipeline.status)}
                  <div>
                    <h4 className="font-semibold text-white">{pipeline.name}</h4>
                    <div className="flex items-center space-x-4 text-sm text-slate-400 mt-1">
                      <div className="flex items-center space-x-1">
                        <GitBranch className="h-4 w-4" />
                        <span>{pipeline.branch}</span>
                      </div>
                      <span>-</span>
                      <span>{pipeline.commits} commits</span>
                      <span>-</span>
                      <span>{pipeline.lastRun}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(pipeline.status)}`}>
                      {pipeline.environment}
                    </div>
                    <div className="text-sm text-slate-400 mt-1">{pipeline.duration}</div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                      <Play className="h-4 w-4 text-slate-400" />
                    </button>
                    <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                      <Pause className="h-4 w-4 text-slate-400" />
                    </button>
                  </div>
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
