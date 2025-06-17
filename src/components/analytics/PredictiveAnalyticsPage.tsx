import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Brain, Zap, AlertTriangle, CheckCircle } from 'lucide-react';

interface Prediction {
  id: string;
  type: 'traffic' | 'cost' | 'performance' | 'scaling';
  title: string;
  description: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  timeframe: string;
  recommendation: string;
  data: number[];
}

const PredictiveAnalyticsPage: React.FC = () => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState('7d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPredictions();
  }, [selectedTimeframe]);

  const fetchPredictions = async () => {
    // Mock predictions data
    setTimeout(() => {
      setPredictions([
        {
          id: '1',
          type: 'traffic',
          title: 'Traffic Spike Predicted',
          description: 'Expected 300% increase in traffic during weekend',
          confidence: 87,
          impact: 'high',
          timeframe: 'Next 48 hours',
          recommendation: 'Scale up instances by 200% before Friday 6 PM',
          data: [100, 120, 150, 180, 220, 280, 350, 400]
        },
        {
          id: '2',
          type: 'cost',
          title: 'Cost Optimization Opportunity',
          description: 'Unused resources detected during off-peak hours',
          confidence: 92,
          impact: 'medium',
          timeframe: 'Ongoing',
          recommendation: 'Implement auto-scaling to reduce costs by 35%',
          data: [1200, 1150, 1100, 950, 800, 750, 780, 820]
        },
        {
          id: '3',
          type: 'performance',
          title: 'Database Performance Degradation',
          description: 'Query response times trending upward',
          confidence: 78,
          impact: 'medium',
          timeframe: 'Next 3 days',
          recommendation: 'Add read replicas and optimize slow queries',
          data: [150, 165, 180, 195, 210, 225, 240, 255]
        },
        {
          id: '4',
          type: 'scaling',
          title: 'Auto-scaling Threshold Adjustment',
          description: 'Current thresholds may cause unnecessary scaling',
          confidence: 85,
          impact: 'low',
          timeframe: 'Next week',
          recommendation: 'Adjust CPU threshold from 70% to 80%',
          data: [70, 72, 75, 78, 80, 82, 85, 88]
        }
      ]);
      setLoading(false);
    }, 1000);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'traffic':
        return <TrendingUp className="h-5 w-5" />;
      case 'cost':
        return <TrendingDown className="h-5 w-5" />;
      case 'performance':
        return <Zap className="h-5 w-5" />;
      case 'scaling':
        return <Brain className="h-5 w-5" />;
      default:
        return <Brain className="h-5 w-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'traffic':
        return 'from-blue-500 to-cyan-500';
      case 'cost':
        return 'from-green-500 to-emerald-500';
      case 'performance':
        return 'from-orange-500 to-red-500';
      case 'scaling':
        return 'from-purple-500 to-pink-500';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'low':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
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
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Predictive Analytics</h1>
              <p className="text-gray-400">AI-powered insights and predictions for your infrastructure</p>
            </div>
            <select
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:border-purple-400 focus:outline-none"
            >
              <option value="24h">Next 24 Hours</option>
              <option value="7d">Next 7 Days</option>
              <option value="30d">Next 30 Days</option>
            </select>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <Brain className="h-8 w-8 text-blue-400" />
              <span className="text-2xl font-bold text-white">{predictions.length}</span>
            </div>
            <h3 className="text-blue-400 font-medium">Active Predictions</h3>
            <p className="text-xs text-gray-400 mt-1">AI-generated insights</p>
          </div>

          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <CheckCircle className="h-8 w-8 text-green-400" />
              <span className="text-2xl font-bold text-white">
                {Math.round(predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length)}%
              </span>
            </div>
            <h3 className="text-green-400 font-medium">Avg Confidence</h3>
            <p className="text-xs text-gray-400 mt-1">Prediction accuracy</p>
          </div>

          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <AlertTriangle className="h-8 w-8 text-red-400" />
              <span className="text-2xl font-bold text-white">
                {predictions.filter(p => p.impact === 'high').length}
              </span>
            </div>
            <h3 className="text-red-400 font-medium">High Impact</h3>
            <p className="text-xs text-gray-400 mt-1">Requires attention</p>
          </div>

          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <Zap className="h-8 w-8 text-purple-400" />
              <span className="text-2xl font-bold text-white">
                {predictions.filter(p => p.timeframe.includes('24') || p.timeframe.includes('48')).length}
              </span>
            </div>
            <h3 className="text-purple-400 font-medium">Immediate Action</h3>
            <p className="text-xs text-gray-400 mt-1">Next 48 hours</p>
          </div>
        </div>

        {/* Predictions List */}
        <div className="space-y-6">
          {predictions.map((prediction) => (
            <div
              key={prediction.id}
              className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-4">
                    <div className={`p-3 bg-gradient-to-r ${getTypeColor(prediction.type)} rounded-xl`}>
                      {getTypeIcon(prediction.type)}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-white mb-2">{prediction.title}</h3>
                      <p className="text-gray-300 mb-3">{prediction.description}</p>
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="text-gray-400">Timeframe: {prediction.timeframe}</span>
                        <span className={`font-medium ${getConfidenceColor(prediction.confidence)}`}>
                          {prediction.confidence}% confidence
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getImpactColor(prediction.impact)}`}>
                          {prediction.impact} impact
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Trend Chart */}
                <div className="mb-4">
                  <h4 className="text-white font-medium mb-2">Trend Analysis</h4>
                  <div className="h-24 flex items-end justify-between space-x-1 bg-black/20 rounded-lg p-4">
                    {prediction.data.map((value, index) => {
                      const maxValue = Math.max(...prediction.data);
                      const height = (value / maxValue) * 100;
                      return (
                        <div
                          key={index}
                          className={`bg-gradient-to-t ${getTypeColor(prediction.type)} rounded-t flex-1`}
                          style={{ height: `${height}%` }}
                          title={`Value: ${value}`}
                        ></div>
                      );
                    })}
                  </div>
                </div>

                {/* Recommendation */}
                <div className="bg-white/5 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-2 flex items-center space-x-2">
                    <Brain className="h-4 w-4 text-purple-400" />
                    <span>AI Recommendation</span>
                  </h4>
                  <p className="text-gray-300 text-sm">{prediction.recommendation}</p>
                  <div className="flex space-x-2 mt-3">
                    <button className="px-4 py-2 bg-purple-500/20 text-purple-300 rounded-lg hover:bg-purple-500/30 transition-colors text-sm">
                      Apply Recommendation
                    </button>
                    <button className="px-4 py-2 bg-gray-600/20 text-gray-300 rounded-lg hover:bg-gray-600/30 transition-colors text-sm">
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* AI Model Performance */}
        <div className="mt-8 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-xl p-6 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">AI Model Performance</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">94.2%</div>
              <p className="text-sm text-gray-400">Prediction Accuracy</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">2.1s</div>
              <p className="text-sm text-gray-400">Avg Processing Time</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">1,247</div>
              <p className="text-sm text-gray-400">Predictions Made</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PredictiveAnalyticsPage;