import React from 'react';
import { DollarSign, TrendingDown, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';

const CostOptimization: React.FC = () => {
  const costData = [
    { month: 'Jan', actual: 2400, projected: 2200 },
    { month: 'Feb', actual: 2100, projected: 2000 },
    { month: 'Mar', actual: 2800, projected: 2400 },
    { month: 'Apr', actual: 2300, projected: 2100 },
    { month: 'May', actual: 1900, projected: 1800 },
    { month: 'Jun', actual: 2200, projected: 2000 }
  ];

  const recommendations = [
    {
      type: 'high-impact',
      title: 'Switch to Reserved Instances',
      description: 'Your EC2 usage patterns show consistent high utilization. Reserved instances could save 40% on compute costs.',
      savings: '$234/month',
      effort: 'Low',
      status: 'recommended'
    },
    {
      type: 'medium-impact',
      title: 'Right-size Database Instances',
      description: 'Your RDS instances are over-provisioned. Scaling down could maintain performance while reducing costs.',
      savings: '$89/month',
      effort: 'Medium',
      status: 'in-progress'
    },
    {
      type: 'low-impact',
      title: 'Enable S3 Lifecycle Policies',
      description: 'Automatically transition old objects to cheaper storage classes and delete unnecessary files.',
      savings: '$45/month',
      effort: 'Low',
      status: 'completed'
    },
    {
      type: 'medium-impact',
      title: 'Optimize Load Balancer Usage',
      description: 'Consider using Application Load Balancer instead of Classic Load Balancer for better cost efficiency.',
      savings: '$67/month',
      effort: 'Medium',
      status: 'recommended'
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-400" />;
      case 'in-progress':
        return <AlertCircle className="h-5 w-5 text-yellow-400" />;
      default:
        return <DollarSign className="h-5 w-5 text-amber-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'in-progress':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      default:
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    }
  };

  const totalSavings = recommendations.reduce((sum, rec) => {
    const amount = parseInt(rec.savings.replace(/[$,\/month]/g, ''));
    return sum + amount;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-red-400 text-sm font-medium">Current Monthly Cost</span>
            <TrendingUp className="h-5 w-5 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-white">$2,200</div>
          <div className="text-xs text-red-300">+8% from last month</div>
        </div>

        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-green-400 text-sm font-medium">Potential Savings</span>
            <TrendingDown className="h-5 w-5 text-green-400" />
          </div>
          <div className="text-2xl font-bold text-white">${totalSavings}</div>
          <div className="text-xs text-green-300">Per month</div>
        </div>

        <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-teal-400 text-sm font-medium">Optimization Score</span>
            <span className="text-teal-400 text-lg">%</span>
          </div>
          <div className="text-2xl font-bold text-white">72</div>
          <div className="text-xs text-teal-300">Good efficiency</div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-amber-400 text-sm font-medium">YTD Savings</span>
            <DollarSign className="h-5 w-5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white">$1,240</div>
          <div className="text-xs text-amber-300">From AI optimization</div>
        </div>
      </div>

      <div className="bg-white/5 rounded-xl border border-white/10 p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Cost Trend Analysis</h3>
        <div className="h-64 flex items-end justify-between space-x-2">
          {costData.map((data, index) => (
            <div key={index} className="flex-1 flex flex-col items-center">
              <div className="w-full max-w-12 flex flex-col space-y-1 mb-2">
                <div 
                  className="bg-amber-500 rounded-t"
                  style={{ height: `${(data.actual / 3000) * 200}px` }}
                ></div>
                <div 
                  className="bg-amber-300/50 rounded-t"
                  style={{ height: `${(data.projected / 3000) * 200}px` }}
                ></div>
              </div>
              <span className="text-xs text-slate-400">{data.month}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center space-x-4 mt-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-amber-500 rounded"></div>
            <span className="text-slate-400">Actual Cost</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-amber-300/50 rounded"></div>
            <span className="text-slate-400">Projected Savings</span>
          </div>
        </div>
      </div>

      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h3 className="text-xl font-semibold text-white mb-2">AI Optimization Recommendations</h3>
          <p className="text-slate-400">Automated cost-saving opportunities identified by AI analysis</p>
        </div>

        <div className="divide-y divide-white/10">
          {recommendations.map((rec, index) => (
            <div key={index} className="p-6 hover:bg-white/5 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  {getStatusIcon(rec.status)}
                  <div className="flex-1">
                    <h4 className="font-semibold text-white mb-1">{rec.title}</h4>
                    <p className="text-slate-400 text-sm mb-3">{rec.description}</p>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="text-green-400 font-medium">{rec.savings}</span>
                      <span className="text-slate-500">-</span>
                      <span className="text-slate-400">Effort: {rec.effort}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(rec.status)}`}>
                    {rec.status.replace('-', ' ')}
                  </span>
                  {rec.status === 'recommended' && (
                    <button className="px-4 py-2 bg-amber-500/20 text-amber-300 rounded-lg hover:bg-amber-500/30 transition-colors text-sm">
                      Apply
                    </button>
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

export default CostOptimization;
