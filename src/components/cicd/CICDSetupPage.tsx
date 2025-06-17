import React, { useState, useEffect } from 'react';
import { GitBranch, Github, Gitlab, Play, Settings, CheckCircle, Loader2 } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

interface Repository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  default_branch: string;
  language: string;
}

interface Pipeline {
  id: number;
  name: string;
  repository_url: string;
  branch: string;
  framework: string;
  cloud_provider: string;
  status: string;
  deployments: any[];
}

const CICDSetupPage: React.FC = () => {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [branch, setBranch] = useState('main');
  const [framework, setFramework] = useState('react');
  const [cloudProvider, setCloudProvider] = useState('aws');
  const [loading, setLoading] = useState(false);
  const [fetchingRepos, setFetchingRepos] = useState(false);
  const [fetchingPipelines, setFetchingPipelines] = useState(false);
  const [pipelineConfig, setPipelineConfig] = useState('');
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    fetchRepositories();
    fetchPipelines();
  }, []);

  const fetchRepositories = async () => {
    setFetchingRepos(true);
    setError('');
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/cicd/repositories`);
      setRepositories(response.data);
    } catch (error: any) {
      console.error('Failed to fetch repositories:', error);
      setError(error.response?.data?.error || 'Failed to fetch repositories. Please check your GitHub integration.');
    } finally {
      setFetchingRepos(false);
    }
  };

  const fetchPipelines = async () => {
    setFetchingPipelines(true);
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/cicd/pipelines`);
      setPipelines(response.data);
    } catch (error: any) {
      console.error('Failed to fetch pipelines:', error);
      setError(error.response?.data?.error || 'Failed to fetch pipelines');
    } finally {
      setFetchingPipelines(false);
    }
  };

  const handleCreatePipeline = async () => {
    if (!selectedRepo) return;

    setLoading(true);
    setError('');
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/cicd/pipeline`, {
        repositoryUrl: selectedRepo.html_url,
        branch,
        framework,
        cloudProvider
      });

      setPipelineConfig(response.data.pipelineConfig);
      setStep(3);
      fetchPipelines(); // Refresh pipelines list
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to create pipeline');
    } finally {
      setLoading(false);
    }
  };

  const handleDeploy = async (pipelineId: number) => {
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/cicd/deploy/${pipelineId}`);
      fetchPipelines(); // Refresh to show new deployment
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to trigger deployment');
    }
  };

  const frameworks = [
    { id: 'react', name: 'React', description: 'Modern React application' },
    { id: 'vue', name: 'Vue.js', description: 'Vue.js application' },
    { id: 'angular', name: 'Angular', description: 'Angular application' },
    { id: 'node', name: 'Node.js', description: 'Node.js backend service' },
    { id: 'python', name: 'Python', description: 'Python application' }
  ];

  const cloudProviders = [
    { id: 'aws', name: 'Amazon Web Services', icon: '☁️' },
    { id: 'gcp', name: 'Google Cloud Platform', icon: '🌐' },
    { id: 'azure', name: 'Microsoft Azure', icon: '🔷' }
  ];

  return (
    <div className="pt-20 min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">CI/CD Pipeline Setup</h1>
          <p className="text-gray-400">Configure and manage your deployment pipelines</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pipeline Creation */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-8">
            {step === 1 && (
              <div>
                <h2 className="text-xl font-semibold text-white mb-6">Select Repository</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <button 
                    onClick={() => window.open('https://github.com/login/oauth/authorize?client_id=' + import.meta.env.VITE_GITHUB_CLIENT_ID, '_blank')}
                    className="flex items-center space-x-3 p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <Github className="h-6 w-6 text-white" />
                    <span className="text-white">Connect GitHub</span>
                  </button>
                  <button className="flex items-center space-x-3 p-4 bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors">
                    <Gitlab className="h-6 w-6 text-white" />
                    <span className="text-white">Connect GitLab</span>
                  </button>
                </div>

                {fetchingRepos ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 text-purple-400 animate-spin" />
                  </div>
                ) : repositories.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400 mb-4">No repositories found. Connect your GitHub account to get started.</p>
                    <button 
                      onClick={fetchRepositories}
                      className="text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      Refresh
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {repositories.map((repo) => (
                      <div
                        key={repo.id}
                        onClick={() => setSelectedRepo(repo)}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          selectedRepo?.id === repo.id
                            ? 'border-purple-400 bg-purple-500/20'
                            : 'border-white/20 bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-white">{repo.name}</h3>
                            <p className="text-sm text-gray-400">{repo.full_name}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-sm text-purple-400">{repo.language}</span>
                            <p className="text-xs text-gray-500">{repo.default_branch}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setStep(2)}
                  disabled={!selectedRepo}
                  className="mt-6 px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="text-xl font-semibold text-white mb-6">Configure Pipeline</h2>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Branch
                    </label>
                    <input
                      type="text"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white"
                      placeholder="main"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Framework
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {frameworks.map((fw) => (
                        <div
                          key={fw.id}
                          onClick={() => setFramework(fw.id)}
                          className={`p-4 rounded-lg border cursor-pointer transition-all ${
                            framework === fw.id
                              ? 'border-purple-400 bg-purple-500/20'
                              : 'border-white/20 bg-white/5 hover:bg-white/10'
                          }`}
                        >
                          <h3 className="font-semibold text-white">{fw.name}</h3>
                          <p className="text-sm text-gray-400">{fw.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Cloud Provider
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {cloudProviders.map((provider) => (
                        <div
                          key={provider.id}
                          onClick={() => setCloudProvider(provider.id)}
                          className={`p-4 rounded-lg border cursor-pointer transition-all ${
                            cloudProvider === provider.id
                              ? 'border-purple-400 bg-purple-500/20'
                              : 'border-white/20 bg-white/5 hover:bg-white/10'
                          }`}
                        >
                          <div className="text-center">
                            <div className="text-2xl mb-2">{provider.icon}</div>
                            <h3 className="font-semibold text-white text-sm">{provider.name}</h3>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex space-x-4 mt-8">
                  <button
                    onClick={() => setStep(1)}
                    className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleCreatePipeline}
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Creating Pipeline...
                      </span>
                    ) : (
                      'Create Pipeline'
                    )}
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <h2 className="text-xl font-semibold text-white mb-6">Pipeline Created</h2>
                <div className="bg-gray-800 rounded-lg p-4 mb-6">
                  <pre className="text-sm text-gray-300 overflow-x-auto">
                    {pipelineConfig}
                  </pre>
                </div>
                <button
                  onClick={() => {
                    setStep(1);
                    setSelectedRepo(null);
                  }}
                  className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                >
                  Create Another Pipeline
                </button>
              </div>
            )}
          </div>

          {/* Existing Pipelines */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-8">
            <h2 className="text-xl font-semibold text-white mb-6">Your Pipelines</h2>
            
            {fetchingPipelines ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 text-purple-400 animate-spin" />
              </div>
            ) : pipelines.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400">No pipelines found. Create your first pipeline to get started.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pipelines.map((pipeline) => (
                  <div key={pipeline.id} className="bg-white/5 rounded-lg border border-white/20 p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-white">{pipeline.name}</h3>
                        <p className="text-sm text-gray-400">{pipeline.repository_url}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm text-purple-400">{pipeline.framework}</span>
                        <p className="text-xs text-gray-500">{pipeline.cloud_provider}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {pipeline.deployments?.map((deployment) => (
                        <div
                          key={deployment.id}
                          className="flex items-center justify-between p-2 bg-white/5 rounded"
                        >
                          <div className="flex items-center space-x-2">
                            <span className={`w-2 h-2 rounded-full ${
                              deployment.status === 'success'
                                ? 'bg-green-400'
                                : deployment.status === 'failed'
                                ? 'bg-red-400'
                                : 'bg-yellow-400'
                            }`} />
                            <span className="text-sm text-gray-300">
                              {new Date(deployment.created_at).toLocaleString()}
                            </span>
                          </div>
                          <span className="text-sm text-gray-400">
                            {deployment.status}
                          </span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => handleDeploy(pipeline.id)}
                      className="mt-4 w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
                    >
                      Deploy
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CICDSetupPage;