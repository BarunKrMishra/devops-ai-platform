import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign, Activity, Clock, Target } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

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

const PredictiveAnalyticsPage: React.FC = () => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    fetchPredictions();
  }, [selectedTimeframe, token]);

  const fetchPredictions = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      const response = await axios.get('/api/ai/predictions', {
        headers: { Authorization: `Bearer ${token}` }
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

  const getPredictionIcon = (type: string) => {
    switch (type) {
      case 'traffic':
        return <TrendingUp className="h-6 w-6 text-blue-400" />;
      case 'cost':
        return <DollarSign className="h-6 w-6 text-green-400" />;
      case 'performance':
        return <Activity className="h-6 w-6 text-purple-400" />;
      case 'security':
        return <AlertTriangle className="h-6 w-6 text-red-400" />;
      default:
        return <Target className="h-6 w-6 text-gray-400" />;
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
        return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-400';
    if (confidence >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (loading) {
    return (
      <div className="pt-20 min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400"></div>
      </div>
    );
  }

  return (
    <div className="pt-20 min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">AI-Powered Predictive Analytics</h1>
          <p className="text-gray-400">Intelligent insights and predictions for your infrastructure</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

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
                    ? 'bg-purple-500 text-white'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
              >
                {timeframe}
              </button>
            ))}
          </div>
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
                    <p className="text-sm text-gray-400">{prediction.timeframe}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold ${getConfidenceColor(prediction.confidence)}`}>
                    {prediction.confidence}%
                  </div>
                  <div className="text-xs text-gray-400">Confidence</div>
                </div>
              </div>

              <p className="text-gray-300 mb-4">{prediction.description}</p>

              {/* Data Visualization */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Trend</span>
                  <span className="text-sm text-gray-400">Probability: {(prediction.probability * 100).toFixed(0)}%</span>
                </div>
                <div className="flex items-end space-x-1 h-16">
                  {prediction.data.map((value, index) => (
                    <div
                      key={index}
                      className="flex-1 bg-purple-500/30 rounded-t"
                      style={{ height: `${(value / Math.max(...prediction.data)) * 100}%` }}
                    ></div>
                  ))}
                </div>
              </div>

              <div className="bg-black/20 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Target className="h-4 w-4 text-purple-400" />
                  <span className="text-sm font-medium text-white">Recommendation</span>
                </div>
                <p className="text-sm text-gray-300">{prediction.recommendation}</p>
              </div>
            </div>
          ))}
        </div>

        {/* AI Insights Summary */}
        <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-2xl border border-white/20 p-8">
          <h2 className="text-xl font-semibold text-white mb-6">AI Insights Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-400 mb-2">
                {predictions.length}
              </div>
              <p className="text-gray-400">Active Predictions</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-400 mb-2">
                {predictions.filter(p => p.impact === 'high').length}
              </div>
              <p className="text-gray-400">High Impact Alerts</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-400 mb-2">
                {Math.floor(predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length)}%
              </div>
              <p className="text-gray-400">Average Confidence</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PredictiveAnalyticsPage;