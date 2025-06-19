import React, { useState, useEffect } from 'react';
import { Search, Download, Eye, Plus, Tag } from 'lucide-react';
import axios from 'axios';

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
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  useEffect(() => {
    fetchTemplates();
    fetchCategories();
  }, [selectedCategory, searchTerm]);

  const fetchTemplates = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (searchTerm) params.append('search', searchTerm);

      const response = await axios.get(`http://localhost:3001/api/templates?${params}`);
      setTemplates(response.data);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/templates/meta/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleUseTemplate = async (template: Template) => {
    try {
      // In production, this would create a new project from template
      console.log('Using template:', template);
      alert(`Template "${template.name}" will be used to create a new project`);
    } catch (error) {
      console.error('Failed to use template:', error);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'web': 'bg-blue-500/20 text-blue-300',
      'mobile': 'bg-green-500/20 text-green-300',
      'api': 'bg-purple-500/20 text-purple-300',
      'database': 'bg-orange-500/20 text-orange-300',
      'infrastructure': 'bg-red-500/20 text-red-300',
      'monitoring': 'bg-yellow-500/20 text-yellow-300'
    };
    return colors[category] || 'bg-gray-500/20 text-gray-300';
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
              <h1 className="text-3xl font-bold text-white mb-2">Template Gallery</h1>
              <p className="text-gray-400">Discover and use deployment templates to accelerate your projects</p>
            </div>
            <button
              className="flex items-center space-x-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Create Template</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Search Templates
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:border-purple-400 focus:outline-none"
                  placeholder="Search by name or description..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white focus:border-purple-400 focus:outline-none"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.category} value={cat.category}>
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
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
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
                  <p className="text-gray-400 text-sm mb-3 line-clamp-2">{template.description}</p>
                </div>
                <button
                  onClick={() => setSelectedTemplate(template)}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
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
                    className="flex items-center space-x-1 px-2 py-1 bg-white/10 text-gray-300 rounded text-xs"
                  >
                    <Tag className="h-3 w-3" />
                    <span>{tag}</span>
                  </span>
                ))}
                {template.tags.length > 3 && (
                  <span className="px-2 py-1 bg-white/10 text-gray-300 rounded text-xs">
                    +{template.tags.length - 3} more
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-sm text-gray-400 mb-4">
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
                className="w-full px-4 py-2 bg-purple-500/20 text-purple-300 rounded-lg hover:bg-purple-500/30 transition-colors"
              >
                Use Template
              </button>
            </div>
          ))}
        </div>

        {templates.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">No templates found matching your criteria</div>
            <button
              className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
            >
              Create the First Template
            </button>
          </div>
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
                    className="text-gray-400 hover:text-white"
                  >
                    ×
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <h3 className="text-lg font-semibold text-white mb-3">Description</h3>
                    <p className="text-gray-300 mb-6">{selectedTemplate.description}</p>
                    
                    <h3 className="text-lg font-semibold text-white mb-3">Template Configuration</h3>
                    <pre className="bg-black/30 p-4 rounded-lg text-sm text-gray-300 overflow-x-auto">
                      {JSON.stringify(selectedTemplate.template_data, null, 2)}
                    </pre>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">Details</h3>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="text-gray-400">Category:</span>
                        <span className="ml-2 text-white">{selectedTemplate.category}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Version:</span>
                        <span className="ml-2 text-white">{selectedTemplate.version}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Downloads:</span>
                        <span className="ml-2 text-white">{selectedTemplate.downloads}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Created by:</span>
                        <span className="ml-2 text-white">{selectedTemplate.created_by_name}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Created:</span>
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
                            className="px-2 py-1 bg-white/10 text-gray-300 rounded text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleUseTemplate(selectedTemplate)}
                      className="w-full mt-6 px-4 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                    >
                      Use This Template
                    </button>
                  </div>
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