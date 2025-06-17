import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, Eye, Calendar, User } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

interface AuditLog {
  id: number;
  user_email: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: any;
  ip_address: string;
  created_at: string;
}

const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchAuditLogs();
  }, [pagination.page, filterAction, dateRange]);

  const fetchAuditLogs = async () => {
    try {
      const endpoint = isAdmin ? '/api/audit/logs' : '/api/audit/my-logs';
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filterAction && { action: filterAction }),
        ...(dateRange.start && { startDate: dateRange.start }),
        ...(dateRange.end && { endDate: dateRange.end })
      });

      const response = await axios.get(`http://localhost:3001${endpoint}?${params}`);
      setLogs(response.data.logs);
      setPagination(prev => ({ ...prev, total: response.data.pagination?.total || 0 }));
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchAuditLogs();
  };

  const exportLogs = async () => {
    try {
      // In production, this would generate and download a CSV/Excel file
      const dataStr = JSON.stringify(logs, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `audit-logs-${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const getActionColor = (action: string) => {
    const colors: { [key: string]: string } = {
      'CREATE_PIPELINE': 'bg-green-500/20 text-green-300',
      'TRIGGER_DEPLOYMENT': 'bg-blue-500/20 text-blue-300',
      'PROVISION_RESOURCE': 'bg-purple-500/20 text-purple-300',
      'SCALE_RESOURCE': 'bg-orange-500/20 text-orange-300',
      'AI_COMMAND': 'bg-pink-500/20 text-pink-300',
      'LOGIN': 'bg-gray-500/20 text-gray-300'
    };
    return colors[action] || 'bg-gray-500/20 text-gray-300';
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
          <h1 className="text-3xl font-bold text-white mb-2">
            {isAdmin ? 'Audit Logs' : 'My Activity'}
          </h1>
          <p className="text-gray-400">
            {isAdmin ? 'Monitor all system activities and user actions' : 'View your account activity history'}
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:border-purple-400 focus:outline-none"
                  placeholder="Search actions..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Action Type
              </label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white focus:border-purple-400 focus:outline-none"
              >
                <option value="">All Actions</option>
                <option value="CREATE_PIPELINE">Create Pipeline</option>
                <option value="TRIGGER_DEPLOYMENT">Trigger Deployment</option>
                <option value="PROVISION_RESOURCE">Provision Resource</option>
                <option value="SCALE_RESOURCE">Scale Resource</option>
                <option value="AI_COMMAND">AI Command</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white focus:border-purple-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white focus:border-purple-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-between items-center mt-6">
            <button
              onClick={handleSearch}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
            >
              <Filter className="h-4 w-4" />
              <span>Apply Filters</span>
            </button>

            <button
              onClick={exportLogs}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Timestamp</th>
                  {isAdmin && <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">User</th>}
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Action</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Resource</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Details</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-300">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-sm text-gray-300">
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span>{log.user_email}</span>
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-300">
                      <div>
                        <div className="font-medium">{log.resource_type}</div>
                        <div className="text-xs text-gray-500">{log.resource_id}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-300">
                      <div className="max-w-xs truncate">
                        {JSON.stringify(log.details)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button className="p-1 text-gray-400 hover:text-white transition-colors">
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
            <div className="text-sm text-gray-400">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page === 1}
                className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page * pagination.limit >= pagination.total}
                className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditLogsPage;