import React from 'react';
import { Server, Database, Cloud, Shield, Globe, Cpu } from 'lucide-react';

const InfrastructureMap: React.FC = () => {
  const regions = [
    {
      name: 'US East (N. Virginia)',
      code: 'us-east-1',
      services: [
        { type: 'compute', name: 'EC2 Instances', count: 8, status: 'healthy' },
        { type: 'database', name: 'RDS PostgreSQL', count: 2, status: 'healthy' },
        { type: 'storage', name: 'S3 Buckets', count: 12, status: 'healthy' },
        { type: 'network', name: 'Load Balancer', count: 3, status: 'healthy' }
      ]
    },
    {
      name: 'EU West (Ireland)',
      code: 'eu-west-1',
      services: [
        { type: 'compute', name: 'EC2 Instances', count: 4, status: 'healthy' },
        { type: 'database', name: 'RDS MySQL', count: 1, status: 'warning' },
        { type: 'storage', name: 'S3 Buckets', count: 6, status: 'healthy' }
      ]
    },
    {
      name: 'Asia Pacific (Tokyo)',
      code: 'ap-northeast-1',
      services: [
        { type: 'compute', name: 'EC2 Instances', count: 2, status: 'healthy' },
        { type: 'storage', name: 'S3 Buckets', count: 3, status: 'healthy' }
      ]
    }
  ];

  const getServiceIcon = (type: string) => {
    switch (type) {
      case 'compute':
        return <Server className="h-5 w-5" />;
      case 'database':
        return <Database className="h-5 w-5" />;
      case 'storage':
        return <Cloud className="h-5 w-5" />;
      case 'network':
        return <Globe className="h-5 w-5" />;
      default:
        return <Cpu className="h-5 w-5" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-400 bg-green-500/20 border-green-500/30';
      case 'warning':
        return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 'error':
        return 'text-red-400 bg-red-500/20 border-red-500/30';
      default:
        return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-blue-400 text-sm font-medium">Total Instances</span>
            <Server className="h-5 w-5 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white">14</div>
          <div className="text-xs text-blue-300">Across 3 regions</div>
        </div>

        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-purple-400 text-sm font-medium">Databases</span>
            <Database className="h-5 w-5 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white">3</div>
          <div className="text-xs text-purple-300">1 needs attention</div>
        </div>

        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-green-400 text-sm font-medium">Uptime</span>
            <Shield className="h-5 w-5 text-green-400" />
          </div>
          <div className="text-2xl font-bold text-white">99.9%</div>
          <div className="text-xs text-green-300">Last 30 days</div>
        </div>
      </div>

      <div className="space-y-4">
        {regions.map((region, index) => (
          <div key={index} className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
            <div className="p-4 border-b border-white/10 bg-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white">{region.name}</h3>
                  <p className="text-sm text-gray-400">{region.code}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm text-green-400">Active</span>
                </div>
              </div>
            </div>
            
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {region.services.map((service, serviceIndex) => (
                  <div key={serviceIndex} className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`p-2 rounded-lg ${getStatusColor(service.status)}`}>
                        {getServiceIcon(service.type)}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(service.status)}`}>
                        {service.status}
                      </span>
                    </div>
                    <h4 className="font-medium text-white text-sm">{service.name}</h4>
                    <p className="text-xs text-gray-400 mt-1">{service.count} active</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-xl p-6 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-2">AI Recommendations</h3>
        <div className="space-y-2 text-sm text-gray-300">
          <p>• Consider adding auto-scaling to your EU West instances to handle traffic spikes</p>
          <p>• Your Tokyo region could benefit from a CDN integration for better performance</p>
          <p>• Database in EU West showing high CPU usage - consider upgrading instance type</p>
        </div>
        <button className="mt-4 px-4 py-2 bg-purple-500/20 text-purple-300 rounded-lg hover:bg-purple-500/30 transition-colors">
          Apply Recommendations
        </button>
      </div>
    </div>
  );
};

export default InfrastructureMap;