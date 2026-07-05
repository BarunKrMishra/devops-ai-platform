import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { DollarSign, TrendingDown, TrendingUp } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import SkeletonBlock from '../ui/SkeletonBlock';
import EmptyState from '../ui/EmptyState';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type CostPoint = {
  month: string;
  total: number;
  compute?: number;
  storage?: number;
  database?: number;
  network?: number;
};

type Recommendation = {
  type: string;
  title: string;
  description: string;
  potentialSavings: number;
  effort: string;
};

type CostResponse = {
  requires_integration?: boolean;
  data_source?: string;
  costData: CostPoint[];
  recommendations: Recommendation[];
  totalSpent: number;
  averageMonthly: number;
};

const effortColor = (effort: string) => {
  switch (effort) {
    case 'low':
      return 'bg-green-500/20 text-green-300 border-green-500/30';
    case 'medium':
      return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
    case 'high':
      return 'bg-red-500/20 text-red-300 border-red-500/30';
    default:
      return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  }
};

const CostOptimization: React.FC = () => {
  const { token } = useAuth();
  const [data, setData] = useState<CostResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsModule, setNeedsModule] = useState(false);

  useEffect(() => {
    const fetchCosts = async () => {
      if (!token) {
        setLoading(false);
        setError('Log in to view cost analytics.');
        return;
      }
      setError('');
      setNeedsModule(false);
      try {
        const { data: res } = await axios.get<CostResponse>(`${API_URL}/api/infrastructure/costs`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setData(res);
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 403) {
          setNeedsModule(true);
        } else {
          setError('Unable to load cost data.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCosts();
  }, [token]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, idx) => (
            <SkeletonBlock key={idx} className="h-20" />
          ))}
        </div>
        <SkeletonBlock className="h-48" />
      </div>
    );
  }

  if (needsModule) {
    return (
      <EmptyState
        title="Enable the AI DevOps module"
        message="Turn on the AI DevOps suite in the Ops Hub to view cost analytics here."
        icon={DollarSign}
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

  if (data?.requires_integration) {
    return (
      <EmptyState
        title="Connect a cloud account"
        message="Connect AWS to see spend trends and AI-driven cost-saving recommendations."
        icon={DollarSign}
      />
    );
  }

  const costData = data?.costData || [];
  const recommendations = data?.recommendations || [];
  const totalSavings = recommendations.reduce((sum, rec) => sum + (rec.potentialSavings || 0), 0);
  const maxTotal = Math.max(1, ...costData.map((point) => point.total));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-red-400 text-sm font-medium">Total spent (6 mo)</span>
            <TrendingUp className="h-5 w-5 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-white">${data?.totalSpent ?? 0}</div>
        </div>

        <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-teal-400 text-sm font-medium">Avg. monthly</span>
            <DollarSign className="h-5 w-5 text-teal-400" />
          </div>
          <div className="text-2xl font-bold text-white">${data?.averageMonthly ?? 0}</div>
        </div>

        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-green-400 text-sm font-medium">Potential savings</span>
            <TrendingDown className="h-5 w-5 text-green-400" />
          </div>
          <div className="text-2xl font-bold text-white">${totalSavings}</div>
          <div className="text-xs text-green-300">Per month</div>
        </div>
      </div>

      {costData.length > 0 && (
        <div className="bg-white/5 rounded-xl border border-white/10 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Cost trend</h3>
          <div className="h-48 flex items-end justify-between space-x-2">
            {costData.map((point) => (
              <div key={point.month} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full max-w-12 bg-amber-500 rounded-t"
                  style={{ height: `${(point.total / maxTotal) * 160}px` }}
                ></div>
                <span className="text-xs text-slate-400 mt-2">{point.month}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          <div className="p-6 border-b border-white/10">
            <h3 className="text-lg font-semibold text-white mb-1">Optimization recommendations</h3>
            <p className="text-slate-400 text-sm">Cost-saving opportunities identified by AI analysis.</p>
          </div>
          <div className="divide-y divide-white/10">
            {recommendations.map((rec) => (
              <div key={rec.type} className="p-6 hover:bg-white/5 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h4 className="font-semibold text-white mb-1">{rec.title}</h4>
                    <p className="text-slate-400 text-sm mb-3">{rec.description}</p>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="text-green-400 font-medium">${rec.potentialSavings}/mo</span>
                      <span className={`px-2 py-1 rounded-full text-xs border ${effortColor(rec.effort)}`}>
                        {rec.effort} effort
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CostOptimization;
