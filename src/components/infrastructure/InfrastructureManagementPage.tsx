import React, { useState, useEffect } from 'react';
import { Server, Database, Cloud, Plus, Settings, Activity, DollarSign } from 'lucide-react';
import axios from 'axios';

interface Resource {
  id: number;
  resource_type: string;
  resource_id: string;
  region: string;
  status: string;
  configuration: any;
  cost_per_hour: number;
  created_at: string;
}

const InfrastructureManagementPage: React.FC = () => {
  const [resources, setResources] = useState<Resource[]>([]);
  const [overview, setOverview] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);

  useEffect(() => {
    fetchInfrastructureData();
  }, []);

  const fetchInfrastructureData = async () => {
    try {
      const [overviewRes] = await Promise.all([
        axios.get('http://localhost:3001/api/infrastructure/overview')
      ]);
      
      setOverview(overviewRes.data);
    } catch (error) {
      console.error('Failed to fetch infrastructure data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProvisionResource = async (resourceType: string, configuration: any) => {
    if (!selectedProject) return;

    try {
      await axios.post('http://localhost:3001/api/infrastructure/provision', {
        projectId: selectedProject,
        resourceType,
        configuration
      });
      
      setShowProvisionModal(false);
      fetchInfrastructureData();
    } catch (error) {
      console.error('Failed to provision resource:', error);
    }
  };

  const resourceTypes = [
    {
      type: 'ec2',
      name: 'EC2 Instance',
      icon: Server,
      description: 'Virtual compute instances',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      type: 'rds',
      name: 'RDS Database',
      icon: Database,
      description: 'Managed database service',
      color: 'from-green-500 to-emerald-500'
    },
    {
      type: 's3',
      name: 'S3 Storage',
      icon: Cloud,
      description: 'Object storage service',
      color: 'from-purple-500 to-pink-500'
    }
  ];

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
          <h1 className="text-3xl font-bold text-white mb-2">Infrastructure Management</h1>
          <p className="text-gray-400">Provision and manage your cloud resources with AI assistance</p>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <Server className="h-8 w-8 text-blue-400" />
              <span className="text-2xl font-bold text-white">{overview.totalInstances || 0}</span>
            </div>
            <h3 className="text-blue-400 font-medium">Total Instances</h3>
            <p className="text-xs text-gray-400 mt-1">Across all regions</p>
          </div>

          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <Database className="h-8 w-8 text-green-400" />
              <span className="text-2xl font-bold text-white">{overview.totalDatabases || 0}</span>
            </div>
            <h3 className="text-green-400 font-medium">Databases</h3>
            <p className="text-xs text-gray-400 mt-1">Active databases</p>
          </div>

          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <Activity className="h-8 w-8 text-purple-400" />
              <span className="text-2xl font-bold text-white">99.9%</span>
            </div>
            <h3 className="text-purple-400 font-medium">Uptime</h3>
            <p className="text-xs text-gray-400 mt-1">Last 30 days</p>
          </div>

          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <DollarSign className="h-8 w-8 text-orange-400" />
              <span className="text-2xl font-bold text-white">${overview.monthlyCost?.toFixed(0) || 0}</span>
            </div>
            <h3 className="text-orange-400 font-medium">Monthly Cost</h3>
            <p className="text-xs text-gray-400 mt-1">Estimated</p>
          </div>
        </div>

        {/* Resource Provisioning */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Provision New Resources</h2>
            <button
              onClick={() => setShowProvisionModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add Resource</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {resourceTypes.map((resource) => (
              <div
                key={resource.type}
                className="bg-white/5 rounded-xl p-6 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                onClick={() => {
                  setSelectedProject(1); // Mock project ID
                  handleProvisionResource(resource.type, {
                    instanceType: resource.type === 'ec2' ? 't3.micro' : undefined,
                    instanceClass: resource.type === 'rds' ? 'db.t3.micro' : undefined,
                    region: 'us-east-1'
                  });
                }}
              >
                <div className={`p-3 bg-gradient-to-r ${resource.color} rounded-lg w-fit mb-4`}>
                  <resource.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{resource.name}</h3>
                <p className="text-gray-400 text-sm">{resource.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* AI Recommendations */}
        <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-xl p-6 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">AI Recommendations</h3>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-purple-400 rounded-full mt-2"></div>
              <p className="text-gray-300 text-sm">
                Consider enabling auto-scaling for your EC2 instances to handle traffic spikes efficiently
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-400 rounded-full mt-2"></div>
              <p className="text-gray-300 text-sm">
                Your database could benefit from read replicas to improve performance
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
              <p className="text-gray-300 text-sm">
                Switch to Reserved Instances to save up to 40% on compute costs
              </p>
            </div>
          </div>
          <button className="mt-4 px-4 py-2 bg-purple-500/20 text-purple-300 rounded-lg hover:bg-purple-500/30 transition-colors">
            Apply Recommendations
          </button>
        </div>
      </div>
    </div>
  );
};

export default InfrastructureManagementPage;