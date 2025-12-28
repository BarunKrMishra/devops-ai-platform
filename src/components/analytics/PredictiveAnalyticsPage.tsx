import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, AlertTriangle, DollarSign, Activity, Target, Sparkles } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import EmptyState from '../ui/EmptyState';
import SkeletonBlock from '../ui/SkeletonBlock';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Prediction {
  id: string;
  type: 'traffic' | 'cost' | 'performance' | 'security';
  title: string;
  description: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  timeframe: string;
  recommendation: string;
  data: number[];
  probability: number;
}

interface UsageMetric {
  metric_type: string;
  total_value: number;
  unit: string;
  data_points: number;
}

const PredictiveAnalyticsPage: React.FC = () => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [usageMetrics, setUsageMetrics] = useState<UsageMetric[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);
  const { token, onboarding } = useAuth();
  const showDemoData = onboarding?.demo_mode !== false;

  const timeframeParam = useMemo(() => {
    if (selectedTimeframe === '1d') return '24h';
    if (selectedTimeframe === '7d') return '7d';
    if (selectedTimeframe === '30d') return '30d';
    return '30d';
  }, [selectedTimeframe]);

  const summaryStats = useMemo(() => {
    const highImpact = predictions.filter((prediction) => prediction.impact === 'high').length;
    const avgConfidence = predictions.length
      ? Math.round(predictions.reduce((sum, prediction) => sum + prediction.confidence, 0) / predictions.length)
      : 0;

    return {
      activePredictions: predictions.length,
      highImpact,
      avgConfidence
    };
  }, [predictions]);

  useEffect(() => {
    if (!showDemoData) {
      setPredictions([]);
      setUsageMetrics([]);
      setLoading(false);
      return;
    }
    fetchPredictions();
    fetchUsageMetrics();
  }, [selectedTimeframe, token, showDemoData]);

  const fetchPredictions = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/ai/predictions`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { timeframe: selectedTimeframe }
      });
      setPredictions(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch predictions:', err);
      setError('Failed to load predictions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsageMetrics = async () => {
    if (!token) return;

    try {
      const response = await axios.get(`${API_URL}/api/organizations/usage`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { period: timeframeParam }
      });
      setUsageMetrics(response.data || []);
      setUsageError(null);
    } catch (err) {
      console.error('Failed to fetch usage metrics:', err);
      setUsageError('Usage metrics are not available yet.');
    }
  };

  const getPredictionIcon = (type: string) => {
    switch (type) {
      case 'traffic':
        return <TrendingUp className="h-6 w-6 text-teal-400" />;
      case 'cost':
        return <DollarSign className="h-6 w-6 text-green-400" />;
      case 'performance':
        return <Activity className="h-6 w-6 text-amber-400" />;
      case 'security':
        return <AlertTriangle className="h-6 w-6 text-red-400" />;
      default:
        return <Target className="h-6 w-6 text-slate-400" />;
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'medium':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'low':
        return 'text-green-400 bg-green-500/10 border-green-500/20';
      default:
        return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-400';
    if (confidence >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (loading) {
    return (
      <div className="pt-20 min-h-screen bg-aikya">
        <div className="container mx-auto px-6 py-8 space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <SkeletonBlock key={idx} className="h-24" />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <SkeletonBlock key={idx} className="h-40" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!showDemoData) {
    return (
      <div className="pt-20 min-h-screen bg-aikya">
        <div className="container mx-auto px-6 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">AI-Powered Predictive Analytics</h1>
            <p className="text-slate-400">Live predictions will appear once data sources are connected.</p>
          </div>
          <EmptyState
            title="Awaiting live signals"
            message="Connect pipelines, monitoring, and cloud data to unlock AI predictions."
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
          <h1 className="text-3xl font-bold text-white mb-2">AI-Powered Predictive Analytics</h1>
          <p className="text-slate-400">Intelligent insights and predictions for your infrastructure</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-4">
            <h3 className="text-sm font-semibold text-white mb-2">Forecast risk</h3>
            <p className="text-xs text-slate-300">
              Predict traffic spikes, cost shifts, and security drift before they impact delivery.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-4">
            <h3 className="text-sm font-semibold text-white mb-2">Measure adoption</h3>
            <p className="text-xs text-slate-300">
              Track usage metrics to align seats, automation, and ROI across teams.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-4">
            <h3 className="text-sm font-semibold text-white mb-2">Act with clarity</h3>
            <p className="text-xs text-slate-300">
              Turn analytics into recommended actions for infra, CI/CD, and monitoring.
            </p>
          </div>
        </div>

        {/* Timeframe Selector */}
        <div className="mb-6">
          <div className="flex items-center space-x-4">
            <span className="text-white font-medium">Timeframe:</span>
            {['1d', '7d', '30d', '90d'].map((timeframe) => (
              <button
                key={timeframe}
                onClick={() => setSelectedTimeframe(timeframe)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  selectedTimeframe === timeframe
                    ? 'bg-amber-500 text-white'
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                {timeframe}
              </button>
            ))}
          </div>
        </div>

        {/* Usage Snapshot */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Usage Snapshot</h2>
              <p className="text-sm text-slate-400">Live usage totals for the selected period.</p>
            </div>
            <span className="text-xs text-slate-400 uppercase tracking-widest">{selectedTimeframe}</span>
          </div>

          {usageMetrics.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {usageMetrics.slice(0, 6).map((metric) => (
                <div key={metric.metric_type} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">{metric.metric_type}</p>
                  <p className="text-2xl font-semibold text-white mt-2">
                    {Math.round(metric.total_value)} {metric.unit}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{metric.data_points} data points</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              {usageError || 'Usage metrics will appear once live data starts flowing.'}
            </p>
          )}
        </div>

        {/* Predictions Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {predictions.map((prediction) => (
            <div
              key={prediction.id}
              className={`bg-white/10 backdrop-blur-sm rounded-2xl border p-6 ${getImpactColor(prediction.impact)}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {getPredictionIcon(prediction.type)}
                  <div>
                    <h3 className="text-lg font-semibold text-white">{prediction.title}</h3>
                    <p className="text-sm text-slate-400">{prediction.timeframe}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold ${getConfidenceColor(prediction.confidence)}`}>
                    {prediction.confidence}%
                  </div>
                  <div className="text-xs text-slate-400">Confidence</div>
                </div>
              </div>

              <p className="text-slate-300 mb-4">{prediction.description}</p>

              {/* Data Visualization */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">Trend</span>
                  <span className="text-sm text-slate-400">Probability: {(prediction.probability * 100).toFixed(0)}%</span>
                </div>
                <div className="flex items-end space-x-1 h-16">
                  {prediction.data.map((value, index) => (
                    <div
                      key={index}
                      className="flex-1 bg-amber-500/30 rounded-t"
                      style={{ height: `${(value / Math.max(...prediction.data)) * 100}%` }}
                    ></div>
                  ))}
                </div>
              </div>

              <div className="bg-black/20 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Target className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-medium text-white">Recommendation</span>
                </div>
                <p className="text-sm text-slate-300">{prediction.recommendation}</p>
              </div>
            </div>
          ))}
        </div>

        {predictions.length === 0 && !error && (
          <EmptyState
            title="No predictions yet"
            message="Connect more live data sources to unlock AI predictions for this timeframe."
          />
        )}

        {/* AI Insights Summary */}
        <div className="bg-gradient-to-r from-amber-500/10 to-teal-500/10 rounded-2xl border border-white/20 p-8">
          <h2 className="text-xl font-semibold text-white mb-6">AI Insights Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-400 mb-2">
                {summaryStats.activePredictions}
              </div>
              <p className="text-slate-400">Active Predictions</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-teal-400 mb-2">
                {summaryStats.highImpact}
              </div>
              <p className="text-slate-400">High Impact Alerts</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-400 mb-2">
                {summaryStats.avgConfidence}%
              </div>
              <p className="text-slate-400">Average Confidence</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PredictiveAnalyticsPage;

