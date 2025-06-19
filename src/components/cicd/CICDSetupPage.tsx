import React, { useState, useEffect } from 'react';
import { GitBranch, Github, Gitlab, Play, CheckCircle, Loader2 } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

interface Repository {
  id: number;
  name: string;
  full_name: string;
  language: string;
  default_branch: string;
  html_url: string;
}

interface Pipeline {
  id: string;
  name: string;
  repository_url: string;
  status: 'success' | 'failed' | 'pending';
  framework: string;
  cloud_provider: string;
}

const CICDSetupPage: React.FC = () => {
  const {token } = useAuth();
  const [step, setStep] = useState(1);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [branch, setBranch] = useState('main');
  const [framework, setFramework] = useState('react');
  const [cloudProvider, setCloudProvider] = useState('aws');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pipelineConfig, setPipelineConfig] = useState('');
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [fetchingRepos, setFetchingRepos] = useState(false);
  const [fetchingPipelines, setFetchingPipelines] = useState(false);

  const frameworks = [
    { id: 'react', name: 'React' },
    { id: 'vue', name: 'Vue.js' },
    { id: 'angular', name: 'Angular' },
    { id: 'next', name: 'Next.js' },
  ];

  const cloudProviders = [
    { id: 'aws', name: 'AWS', icon: '☁️' },
    { id: 'azure', name: 'Azure', icon: '🌩️' },
    { id: 'gcp', name: 'GCP', icon: '⚡' },
  ];

  useEffect(() => {
    console.log('CICDSetupPage mounted, token:', token ? 'present' : 'missing');
    if (token) {
      Promise.all([fetchPipelines(), fetchRepositories()])
        .catch(err => {
          console.error('Error fetching initial data:', err);
          setError('Failed to load initial data. Please try refreshing the page.');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
      setError('Authentication token missing. Please log in again.');
    }
  }, [token]);

  const fetchRepositories = async () => {
    if (!token) {
      console.error('No token available for repository fetch');
      return;
    }
    
    setFetchingRepos(true);
    try {
      console.log('Fetching repositories...');
      const response = await axios.get('/api/cicd/repositories', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Repositories fetched:', response.data);
      setRepositories(response.data);
    } catch (err) {
      console.error('Repository fetch error:', err);
      setError('Failed to fetch repositories. Please try again.');
    } finally {
      setFetchingRepos(false);
    }
  };

  const fetchPipelines = async () => {
    if (!token) {
      console.error('No token available for pipeline fetch');
      return;
    }
    
    setFetchingPipelines(true);
    try {
      console.log('Fetching pipelines...');
      const response = await axios.get('/api/cicd/pipelines', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Pipelines fetched:', response.data);
      setPipelines(response.data);
    } catch (err) {
      console.error('Pipeline fetch error:', err);
      setError('Failed to fetch pipelines. Please try again.');
    } finally {
      setFetchingPipelines(false);
    }
  };

  const handleCreatePipeline = async () => {
    if (!selectedRepo || !token) return;
    
    setLoading(true);
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/cicd/pipeline`,
        {
          repositoryUrl: selectedRepo.html_url,
          branch,
          framework,
          cloudProvider
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      setPipelineConfig(JSON.stringify(response.data.pipelineConfig, null, 2));
      setStep(3);
      fetchPipelines();
    } catch (err) {
      setError('Failed to create pipeline');
    } finally {
      setLoading(false);
    }
  };

  const handleDeploy = async (pipelineId: string) => {
    if (!token) return;
    
    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/cicd/deploy/${pipelineId}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      fetchPipelines();
    } catch (err) {
      setError('Failed to deploy pipeline');
    }
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
                    className="flex items-center space-x-3 p-4 bg-gray-800/50 rounded-lg hover:bg-gray-700/50 transition-colors"
                  >
                    <Github className="h-6 w-6 text-white" />
                    <span className="text-white">Connect GitHub</span>
                  </button>
                  <button className="flex items-center space-x-3 p-4 bg-orange-600/50 rounded-lg hover:bg-orange-700/50 transition-colors">
                    <Gitlab className="h-6 w-6 text-white" />
                    <span className="text-white">Connect GitLab</span>
                  </button>
                </div>

                {fetchingRepos ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
                  </div>
                ) : repositories.length > 0 ? (
                  <div className="space-y-4">
                    {repositories.map((repo) => (
                      <button
                        key={repo.id}
                        onClick={() => {
                          setSelectedRepo(repo);
                          setBranch(repo.default_branch);
                          setStep(2);
                        }}
                        className="w-full p-4 bg-gray-800/50 rounded-lg hover:bg-gray-700/50 transition-colors text-left"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-white font-medium">{repo.name}</h3>
                            <p className="text-gray-400 text-sm">{repo.language}</p>
                          </div>
                          <GitBranch className="h-5 w-5 text-gray-400" />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-400">No repositories found. Connect your GitHub account to get started.</p>
                  </div>
                )}
              </div>
            )}

            {step === 2 && selectedRepo && (
              <div>
                <h2 className="text-xl font-semibold text-white mb-6">Configure Pipeline</h2>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Repository
                    </label>
                    <div className="p-3 bg-gray-800/50 rounded-lg">
                      <p className="text-white">{selectedRepo.full_name}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Branch
                    </label>
                    <input
                      type="text"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      className="w-full p-3 bg-gray-800/50 rounded-lg text-white border border-gray-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Framework
                    </label>
                    <select
                      value={framework}
                      onChange={(e) => setFramework(e.target.value)}
                      className="w-full p-3 bg-gray-800/50 rounded-lg text-white border border-gray-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    >
                      {frameworks.map((f) => (
                        <option key={f.id} value={f.id} className="bg-gray-800">
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Cloud Provider
                    </label>
                    <div className="grid grid-cols-3 gap-4">
                      {cloudProviders.map((provider) => (
                        <button
                          key={provider.id}
                          onClick={() => setCloudProvider(provider.id)}
                          className={`p-4 rounded-lg border transition-colors ${
                            cloudProvider === provider.id
                              ? 'bg-purple-500/20 border-purple-500'
                              : 'bg-gray-800/50 border-gray-700 hover:bg-gray-700/50'
                          }`}
                        >
                          <div className="text-2xl mb-2">{provider.icon}</div>
                          <div className="text-white font-medium">{provider.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end space-x-4">
                    <button
                      onClick={() => setStep(1)}
                      className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleCreatePipeline}
                      disabled={loading}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <div className="flex items-center space-x-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Creating...</span>
                        </div>
                      ) : (
                        'Create Pipeline'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <h2 className="text-xl font-semibold text-white mb-6">Pipeline Configuration</h2>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Generated Configuration
                    </label>
                    <pre className="p-4 bg-gray-800/50 rounded-lg overflow-x-auto">
                      <code className="text-sm text-gray-300">{pipelineConfig}</code>
                    </pre>
                  </div>

                  <div className="flex justify-end space-x-4">
                    <button
                      onClick={() => {
                        setStep(1);
                        setSelectedRepo(null);
                        setPipelineConfig('');
                      }}
                      className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                    >
                      Back to Start
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Pipeline List */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-8">
            <h2 className="text-xl font-semibold text-white mb-6">Your Pipelines</h2>
            
            {fetchingPipelines ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
              </div>
            ) : pipelines.length > 0 ? (
              <div className="space-y-4">
                {pipelines.map((pipeline) => (
                  <div
                    key={pipeline.id}
                    className="p-4 bg-gray-800/50 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-white font-medium">{pipeline.name}</h3>
                        <p className="text-gray-400 text-sm">{pipeline.repository_url}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {pipeline.status === 'success' && (
                          <CheckCircle className="h-5 w-5 text-green-400" />
                        )}
                        {pipeline.status === 'failed' && (
                          <div className="h-5 w-5 rounded-full bg-red-400" />
                        )}
                        {pipeline.status === 'pending' && (
                          <div className="animate-spin h-5 w-5 rounded-full border-b-2 border-purple-400" />
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <span className="px-2 py-1 bg-gray-700 rounded text-sm text-gray-300">
                          {pipeline.framework}
                        </span>
                        <span className="px-2 py-1 bg-gray-700 rounded text-sm text-gray-300">
                          {pipeline.cloud_provider}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeploy(pipeline.id)}
                        className="flex items-center space-x-2 px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                      >
                        <Play className="h-4 w-4" />
                        <span>Deploy</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                No pipelines found. Create your first pipeline to get started.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CICDSetupPage;