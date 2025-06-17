import React, { useState } from 'react';
import AIAssistant from './dashboard/AIAssistant';
import PipelineOverview from './dashboard/PipelineOverview';
import InfrastructureMap from './dashboard/InfrastructureMap';
import CostOptimization from './dashboard/CostOptimization';
import { BarChart3, Cloud, MessageSquare, DollarSign, Activity, Settings } from 'lucide-react';

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'infrastructure', label: 'Infrastructure', icon: Cloud },
    { id: 'assistant', label: 'AI Assistant', icon: MessageSquare },
    { id: 'costs', label: 'Cost Optimization', icon: DollarSign },
    { id: 'monitoring', label: 'Monitoring', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  return (
    <div className="pt-20 min-h-screen">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">DevOps Command Center</h1>
          <p className="text-gray-400">Manage your entire infrastructure with AI-powered automation</p>
        </div>

        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
          <div className="border-b border-white/10">
            <nav className="flex overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-6 py-4 whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? 'bg-purple-500/20 text-purple-300 border-b-2 border-purple-400'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <tab.icon className="h-5 w-5" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && <PipelineOverview />}
            {activeTab === 'infrastructure' && <InfrastructureMap />}
            {activeTab === 'assistant' && <AIAssistant />}
            {activeTab === 'costs' && <CostOptimization />}
            {activeTab === 'monitoring' && (
              <div className="text-center py-12">
                <Activity className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Monitoring Dashboard</h3>
                <p className="text-gray-400">Real-time monitoring and alerts coming soon</p>
              </div>
            )}
            {activeTab === 'settings' && (
              <div className="text-center py-12">
                <Settings className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Settings</h3>
                <p className="text-gray-400">Configuration options coming soon</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;