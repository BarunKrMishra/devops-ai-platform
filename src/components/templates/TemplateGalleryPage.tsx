import React, { useState, useEffect } from 'react';
import { Search, Download, Eye, Plus, Tag, X, Copy } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import EmptyState from '../ui/EmptyState';
import SkeletonBlock from '../ui/SkeletonBlock';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const categoryOptions = [
  { value: 'ci-cd', label: 'CI/CD' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'security', label: 'Security' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'cost', label: 'Cost Optimization' },
  { value: 'kubernetes', label: 'Kubernetes' },
  { value: 'cloud', label: 'Cloud Setup' }
];

const defaultTemplateData = `{
  "pipeline": {
    "stages": ["build", "test", "deploy"],
    "runner": "github-actions"
  },
  "infrastructure": {
    "cloud": "aws",
    "region": "ap-south-1"
  },
  "observability": {
    "metrics": ["latency", "error_rate"],
    "alerts": ["slack"]
  }
}`;

interface Template {
  id: number;
  name: string;
  description: string;
  category: string;
  template_data: any;
  is_public: boolean;
  created_by_name: string;
  tags: string[];
  version: string;
  downloads: number;
  created_at: string;
}

const TemplateGalleryPage: React.FC = () => {
  const { token } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    category: '',
    tags: '',
    isPublic: false,
    templateData: defaultTemplateData
  });
  const [createError, setCreateError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    fetchTemplates();
  }, [selectedCategory, searchTerm, token]);

  useEffect(() => {
    fetchCategories();
  }, [token]);

  const fetchTemplates = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (searchTerm) params.append('search', searchTerm);

      const response = await axios.get(`${API_URL}/api/templates?${params}`);
      setTemplates(response.data);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      setActionError('Unable to load templates right now.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    if (!token) {
      return;
    }
    try {
      const response = await axios.get(`${API_URL}/api/templates/meta/categories`);
      setCategories(response.data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleUseTemplate = async (template: Template) => {
    setActionMessage('');
    setActionError('');
    try {
      await axios.get(`${API_URL}/api/templates/${template.id}`);
      setTemplates((prev) =>
        prev.map((item) =>
          item.id === template.id ? { ...item, downloads: item.downloads + 1 } : item
        )
      );
      if (selectedTemplate?.id === template.id) {
        setSelectedTemplate({ ...template, downloads: template.downloads + 1 });
      }
      setActionMessage(`Template "${template.name}" is ready to apply in your next project.`);
    } catch (error) {
      console.error('Failed to use template:', error);
      setActionError('Failed to apply the template.');
    }
  };

  const handleCopyTemplate = async (template: Template) => {
    setActionMessage('');
    setActionError('');
    try {
      await navigator.clipboard.writeText(JSON.stringify(template.template_data, null, 2));
      setActionMessage('Template configuration copied to clipboard.');
    } catch (error) {
      console.error('Failed to copy template:', error);
      setActionError('Copy failed. Please try again.');
    }
  };

  const handleDownloadTemplate = (template: Template) => {
    setActionMessage('');
    setActionError('');
    try {
      const payload = JSON.stringify(template.template_data, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${template.name.replace(/\s+/g, '-').toLowerCase()}-template.json`;
      link.click();
      URL.revokeObjectURL(url);
      setActionMessage('Template JSON downloaded.');
    } catch (error) {
      console.error('Failed to download template:', error);
      setActionError('Download failed. Please try again.');
    }
  };

  const resetCreateForm = () => {
    setCreateForm({
      name: '',
      description: '',
      category: '',
      tags: '',
      isPublic: false,
      templateData: defaultTemplateData
    });
  };

  const handleCreateTemplate = async () => {
    setCreateError('');
    setActionMessage('');
    setActionError('');

    if (!createForm.name.trim()) {
      setCreateError('Template name is required.');
      return;
    }
    if (!createForm.category) {
      setCreateError('Please select a category.');
      return;
    }

    let parsedData: any;
    try {
      parsedData = JSON.parse(createForm.templateData);
    } catch (error) {
      setCreateError('Template configuration must be valid JSON.');
      return;
    }

    const tags = createForm.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    setCreateLoading(true);
    try {
      await axios.post(`${API_URL}/api/templates`, {
        name: createForm.name.trim(),
        description: createForm.description.trim(),
        category: createForm.category,
        template_data: parsedData,
        is_public: createForm.isPublic,
        tags
      });
      setShowCreateModal(false);
      resetCreateForm();
      setActionMessage('Template created and ready to use.');
      await Promise.all([fetchTemplates(), fetchCategories()]);
    } catch (error: any) {
      console.error('Failed to create template:', error);
      setCreateError(error.response?.data?.error || 'Failed to create template.');
    } finally {
      setCreateLoading(false);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'web': 'bg-teal-500/20 text-teal-300',
      'mobile': 'bg-green-500/20 text-green-300',
      'api': 'bg-amber-500/20 text-amber-300',
      'database': 'bg-orange-500/20 text-orange-300',
      'infrastructure': 'bg-red-500/20 text-red-300',
      'monitoring': 'bg-yellow-500/20 text-yellow-300',
      'ci-cd': 'bg-cyan-500/20 text-cyan-300',
      'security': 'bg-rose-500/20 text-rose-300',
      'compliance': 'bg-indigo-500/20 text-indigo-300',
      'cost': 'bg-lime-500/20 text-lime-300',
      'kubernetes': 'bg-sky-500/20 text-sky-300',
      'cloud': 'bg-violet-500/20 text-violet-300'
    };
    return colors[category] || 'bg-slate-500/20 text-slate-300';
  };

  if (loading) {
    return (
      <div className="pt-20 min-h-screen bg-aikya">
        <div className="container mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, idx) => (
              <SkeletonBlock key={idx} className="h-48" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 min-h-screen bg-aikya">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Template Gallery</h1>
              <p className="text-slate-400">Discover and use deployment templates to accelerate your projects</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Create Template</span>
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-3 mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-4">
              <h3 className="text-sm font-semibold text-white mb-2">Standardize Delivery</h3>
              <p className="text-xs text-slate-300">
                Save repeatable CI/CD and infra blueprints so every team deploys the same way.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-4">
              <h3 className="text-sm font-semibold text-white mb-2">Speed Up Onboarding</h3>
              <p className="text-xs text-slate-300">
                Apply templates to new environments and reduce manual setup across projects.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-4">
              <h3 className="text-sm font-semibold text-white mb-2">Share Best Practices</h3>
              <p className="text-xs text-slate-300">
                Publish approved templates for your org or teams to reuse.
              </p>
            </div>
          </div>
        </div>

        {actionMessage && (
          <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {actionMessage}
          </div>
        )}
        {actionError && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {actionError}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Search Templates
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
                  placeholder="Search by name or description..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white focus:border-amber-400 focus:outline-none"
              >
                <option value="" className="bg-slate-900 text-slate-100">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.category} value={cat.category} className="bg-slate-900 text-slate-100">
                    {cat.category} ({cat.count})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('');
                }}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6 hover:bg-white/15 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">{template.name}</h3>
                  <p className="text-slate-400 text-sm mb-3 line-clamp-2">{template.description}</p>
                </div>
                <button
                  onClick={() => setSelectedTemplate(template)}
                  className="p-2 text-slate-400 hover:text-white transition-colors"
                >
                  <Eye className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center space-x-2 mb-4">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(template.category)}`}>
                  {template.category}
                </span>
                {template.is_public && (
                  <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded-full text-xs font-medium">
                    Public
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1 mb-4">
                {template.tags.slice(0, 3).map((tag, index) => (
                  <span
                    key={index}
                    className="flex items-center space-x-1 px-2 py-1 bg-white/10 text-slate-300 rounded text-xs"
                  >
                    <Tag className="h-3 w-3" />
                    <span>{tag}</span>
                  </span>
                ))}
                {template.tags.length > 3 && (
                  <span className="px-2 py-1 bg-white/10 text-slate-300 rounded text-xs">
                    +{template.tags.length - 3} more
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-sm text-slate-400 mb-4">
                <span>by {template.created_by_name}</span>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-1">
                    <Download className="h-4 w-4" />
                    <span>{template.downloads}</span>
                  </div>
                  <span>v{template.version}</span>
                </div>
              </div>

              <button
                onClick={() => handleUseTemplate(template)}
                className="w-full px-4 py-2 bg-amber-500/20 text-amber-300 rounded-lg hover:bg-amber-500/30 transition-colors"
              >
                Use Template
              </button>
            </div>
          ))}
        </div>

        {templates.length === 0 && (
          <EmptyState
            title="No templates yet"
            message="Create the first template to standardize deployments across your teams."
            action={(
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
              >
                Create the first template
              </button>
            )}
          />
        )}

        {/* Template Detail Modal */}
        {selectedTemplate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 rounded-2xl border border-white/20 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white">{selectedTemplate.name}</h2>
                  <button
                    onClick={() => setSelectedTemplate(null)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <h3 className="text-lg font-semibold text-white mb-3">Description</h3>
                    <p className="text-slate-300 mb-6">{selectedTemplate.description}</p>
                    
                    <h3 className="text-lg font-semibold text-white mb-3">Template Configuration</h3>
                    <pre className="bg-black/30 p-4 rounded-lg text-sm text-slate-300 overflow-x-auto">
                      {JSON.stringify(selectedTemplate.template_data, null, 2)}
                    </pre>
                    <div className="flex flex-wrap gap-3 mt-4">
                      <button
                        onClick={() => handleCopyTemplate(selectedTemplate)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/10 transition-all text-sm"
                      >
                        <Copy className="h-4 w-4" />
                        Copy config
                      </button>
                      <button
                        onClick={() => handleDownloadTemplate(selectedTemplate)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/10 transition-all text-sm"
                      >
                        <Download className="h-4 w-4" />
                        Download JSON
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">Details</h3>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="text-slate-400">Category:</span>
                        <span className="ml-2 text-white">{selectedTemplate.category}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Version:</span>
                        <span className="ml-2 text-white">{selectedTemplate.version}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Downloads:</span>
                        <span className="ml-2 text-white">{selectedTemplate.downloads}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Created by:</span>
                        <span className="ml-2 text-white">{selectedTemplate.created_by_name}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Created:</span>
                        <span className="ml-2 text-white">
                          {new Date(selectedTemplate.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-6">
                      <h4 className="text-white font-medium mb-2">Tags</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedTemplate.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-white/10 text-slate-300 rounded text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleUseTemplate(selectedTemplate)}
                      className="w-full mt-6 px-4 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                    >
                      Use This Template
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 rounded-2xl border border-white/20 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white">Create a Template</h2>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setCreateError('');
                    }}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <p className="text-slate-400 text-sm mt-2">
                  Capture pipeline, infrastructure, and monitoring defaults for reuse.
                </p>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-300 mb-2">Template name *</label>
                    <input
                      type="text"
                      value={createForm.name}
                      onChange={(event) =>
                        setCreateForm((prev) => ({ ...prev, name: event.target.value }))
                      }
                      className="w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
                      placeholder="Aikya Kubernetes Rollout"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-2">Category *</label>
                    <select
                      value={createForm.category}
                      onChange={(event) =>
                        setCreateForm((prev) => ({ ...prev, category: event.target.value }))
                      }
                      className="w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white focus:border-amber-400 focus:outline-none"
                    >
                      <option value="" className="bg-slate-900 text-slate-100">Select a category</option>
                      {categoryOptions.map((option) => (
                        <option key={option.value} value={option.value} className="bg-slate-900 text-slate-100">
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-2">Description</label>
                  <textarea
                    value={createForm.description}
                    onChange={(event) =>
                      setCreateForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                    className="w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
                    rows={3}
                    placeholder="Short summary of what this template configures."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-300 mb-2">Tags</label>
                    <input
                      type="text"
                      value={createForm.tags}
                      onChange={(event) =>
                        setCreateForm((prev) => ({ ...prev, tags: event.target.value }))
                      }
                      className="w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
                      placeholder="aws, k8s, production"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      id="template-public"
                      type="checkbox"
                      checked={createForm.isPublic}
                      onChange={(event) =>
                        setCreateForm((prev) => ({ ...prev, isPublic: event.target.checked }))
                      }
                      className="h-4 w-4 rounded border-white/20 bg-white/10 text-amber-500 focus:ring-amber-400"
                    />
                    <label htmlFor="template-public" className="text-sm text-slate-300">
                      Share with the organization
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-2">Template configuration (JSON) *</label>
                  <textarea
                    value={createForm.templateData}
                    onChange={(event) =>
                      setCreateForm((prev) => ({ ...prev, templateData: event.target.value }))
                    }
                    className="w-full p-3 rounded-lg bg-black/30 border border-white/20 text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none font-mono text-sm"
                    rows={10}
                  />
                  <p className="text-xs text-slate-400 mt-2">
                    This JSON powers the defaults Aikya applies during deployments and integrations.
                  </p>
                </div>

                {createError && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {createError}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleCreateTemplate}
                    disabled={createLoading}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-teal-500 text-white hover:from-amber-600 hover:to-teal-600 transition-all disabled:opacity-60"
                  >
                    {createLoading ? 'Saving...' : 'Save template'}
                  </button>
                  <button
                    onClick={() => {
                      resetCreateForm();
                      setCreateError('');
                    }}
                    className="px-6 py-3 rounded-xl border border-white/10 text-white hover:bg-white/10 transition-all"
                  >
                    Reset form
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplateGalleryPage;

