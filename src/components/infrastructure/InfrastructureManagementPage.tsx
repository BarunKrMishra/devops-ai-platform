import React, { useState, useEffect } from 'react';
import { Server, Database, Cloud, Plus, Activity, DollarSign, Sparkles } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import EmptyState from '../ui/EmptyState';
import SkeletonBlock from '../ui/SkeletonBlock';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const InfrastructureManagementPage: React.FC = () => {
  const { onboarding, token } = useAuth();
  const [overview, setOverview] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [requiresIntegration, setRequiresIntegration] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [projectNotice, setProjectNotice] = useState('');
  const showDemoData = onboarding?.demo_mode !== false;

  useEffect(() => {
    fetchInfrastructureData();
  }, [showDemoData, token]);

  const fetchInfrastructureData = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoadError('');
    try {
      const [overviewRes, pipelinesRes] = await Promise.all([
        axios.get(`${API_URL}/api/infrastructure/overview`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/api/cicd/pipelines`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setOverview(overviewRes.data);
      setRequiresIntegration(Boolean(overviewRes.data?.requires_integration));

      const pipelineList = Array.isArray(pipelinesRes.data) ? pipelinesRes.data : [];
      const projectPipelines = pipelineList.filter((item) => item.source === 'project');
      const mappedProjects = projectPipelines.map((item) => ({
        id: item.id,
        name: item.name || item.repository_url || `Project ${item.id}`
      }));
      setProjects(mappedProjects);
      if (!selectedProject && mappedProjects.length > 0) {
        setSelectedProject(mappedProjects[0].id);
      }
      if (mappedProjects.length === 0) {
        setProjectNotice('Create a CI/CD pipeline to enable resource provisioning.');
      } else {
        setProjectNotice('');
      }
    } catch (error) {
      console.error('Failed to fetch infrastructure data:', error);
      setLoadError('Unable to load infrastructure data. Check your AWS integration and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleProvisionResource = async (resourceType: string, configuration: any) => {
    if (!selectedProject) {
      setLoadError('Select a project before provisioning resources.');
      return;
    }

    try {
      await axios.post(
        `${API_URL}/api/infrastructure/provision`,
        {
          projectId: selectedProject,
          resourceType,
          configuration
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      fetchInfrastructureData();
    } catch (error) {
      console.error('Failed to provision resource:', error);
      setLoadError('Provisioning failed. Make sure a project exists and try again.');
    }
  };

  const resourceTypes = [
    {
      type: 'ec2',
      name: 'EC2 Instance',
      icon: Server,
      description: 'Virtual compute instances',
      color: 'from-teal-500 to-cyan-500'
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
      color: 'from-amber-500 to-pink-500'
    }
  ];

  if (loading) {
    return (
      <div className="pt-20 min-h-screen bg-aikya">
        <div className="container mx-auto px-6 py-8 space-y-6">
          <SkeletonBlock className="h-16" />
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <SkeletonBlock key={idx} className="h-28" />
            ))}
          </div>
          <SkeletonBlock className="h-64" />
        </div>
      </div>
    );
  }

  if (!showDemoData && requiresIntegration) {
    return (
      <div className="pt-20 min-h-screen bg-aikya">
        <div className="container mx-auto px-6 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Infrastructure Management</h1>
            <p className="text-slate-400">Live infrastructure data will appear after integrations are connected.</p>
          </div>
          <EmptyState
            title="Awaiting live infrastructure data"
            message="Connect your cloud provider in the Integrations page to populate resources here."
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
          <h1 className="text-3xl font-bold text-white mb-2">Infrastructure Management</h1>
          <p className="text-slate-400">Provision and manage your cloud resources with AI assistance</p>
        </div>

        {loadError && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {loadError}
          </div>
        )}

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <Server className="h-8 w-8 text-teal-400" />
              <span className="text-2xl font-bold text-white">{overview.totalInstances || 0}</span>
            </div>
            <h3 className="text-teal-400 font-medium">Total Instances</h3>
            <p className="text-xs text-slate-400 mt-1">Across all regions</p>
          </div>

          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <Database className="h-8 w-8 text-green-400" />
              <span className="text-2xl font-bold text-white">{overview.totalDatabases || 0}</span>
            </div>
            <h3 className="text-green-400 font-medium">Databases</h3>
            <p className="text-xs text-slate-400 mt-1">Active databases</p>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <Activity className="h-8 w-8 text-amber-400" />
              <span className="text-2xl font-bold text-white">99.9%</span>
            </div>
            <h3 className="text-amber-400 font-medium">Uptime</h3>
            <p className="text-xs text-slate-400 mt-1">Last 30 days</p>
          </div>

          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <DollarSign className="h-8 w-8 text-orange-400" />
              <span className="text-2xl font-bold text-white">${overview.monthlyCost?.toFixed(0) || 0}</span>
            </div>
            <h3 className="text-orange-400 font-medium">Monthly Cost</h3>
            <p className="text-xs text-slate-400 mt-1">Estimated</p>
          </div>
        </div>

        {/* Resource Provisioning */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Provision New Resources</h2>
            <div className="flex items-center gap-3">
              {projects.length > 0 ? (
                <select
                  value={selectedProject ?? ''}
                  onChange={(event) => setSelectedProject(Number(event.target.value))}
                  className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:border-amber-400 focus:outline-none"
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id} className="bg-slate-900 text-slate-100">
                      {project.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-slate-400">{projectNotice || 'No project found yet.'}</span>
              )}
              <button
                onClick={() => {
                  if (!selectedProject) {
                    setLoadError('Create a pipeline first to provision resources.');
                  }
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Add Resource</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {resourceTypes.map((resource) => (
              <div
                key={resource.type}
                className="bg-white/5 rounded-xl p-6 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                onClick={() => {
                  if (!selectedProject) {
                    setLoadError('Create a pipeline first to provision resources.');
                    return;
                  }
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
                <p className="text-slate-400 text-sm">{resource.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* AI Recommendations */}
        <div className="bg-gradient-to-r from-amber-500/10 to-teal-500/10 rounded-xl p-6 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">AI Recommendations</h3>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-amber-400 rounded-full mt-2"></div>
              <p className="text-slate-300 text-sm">
                Consider enabling auto-scaling for your EC2 instances to handle traffic spikes efficiently
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-teal-400 rounded-full mt-2"></div>
              <p className="text-slate-300 text-sm">
                Your database could benefit from read replicas to improve performance
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
              <p className="text-slate-300 text-sm">
                Switch to Reserved Instances to save up to 40% on compute costs
              </p>
            </div>
          </div>
          <button className="mt-4 px-4 py-2 bg-amber-500/20 text-amber-300 rounded-lg hover:bg-amber-500/30 transition-colors">
            Apply Recommendations
          </button>
        </div>
      </div>
    </div>
  );
};

export default InfrastructureManagementPage;
