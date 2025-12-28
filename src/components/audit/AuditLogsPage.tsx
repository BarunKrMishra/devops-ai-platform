import React, { useMemo, useState, useEffect } from 'react';
import { Search, Filter, Download, Eye, Calendar, User, X } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import EmptyState from '../ui/EmptyState';
import SkeletonBlock from '../ui/SkeletonBlock';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  
  const { user, token } = useAuth();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchAuditLogs();
  }, [pagination.page, filterAction, dateRange]);

  const fetchAuditLogs = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const endpoint = isAdmin ? '/api/audit/logs' : '/api/audit/my-logs';
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filterAction && { action: filterAction }),
        ...(dateRange.start && { startDate: dateRange.start }),
        ...(dateRange.end && { endDate: dateRange.end })
      });

      const response = await axios.get(`${API_URL}${endpoint}?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
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

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterAction('');
    setDateRange({ start: '', end: '' });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const filteredLogs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesSearch = term
        ? [
            log.action,
            log.resource_type,
            log.resource_id,
            log.user_email || '',
            JSON.stringify(log.details || {})
          ]
            .join(' ')
            .toLowerCase()
            .includes(term)
        : true;

      const logDate = new Date(log.created_at);
      const matchesStart = dateRange.start ? logDate >= new Date(dateRange.start) : true;
      const matchesEnd = dateRange.end ? logDate <= new Date(`${dateRange.end}T23:59:59`) : true;

      return matchesSearch && matchesStart && matchesEnd;
    });
  }, [logs, searchTerm, dateRange]);

  const parseDetails = (details: any) => {
    if (!details) {
      return null;
    }
    if (typeof details === 'object') {
      return details;
    }
    try {
      return JSON.parse(details);
    } catch (error) {
      return details;
    }
  };

  const exportLogs = async () => {
    if (!token) {
      return;
    }
    try {
      const params = new URLSearchParams({
        ...(filterAction && { action: filterAction }),
        ...(dateRange.start && { startDate: dateRange.start }),
        ...(dateRange.end && { endDate: dateRange.end })
      });

      const response = await axios.get(`${API_URL}/api/audit/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const getActionColor = (action: string) => {
    const colors: { [key: string]: string } = {
      'CREATE_PIPELINE': 'bg-green-500/20 text-green-300',
      'TRIGGER_DEPLOYMENT': 'bg-teal-500/20 text-teal-300',
      'PROVISION_RESOURCE': 'bg-amber-500/20 text-amber-300',
      'SCALE_RESOURCE': 'bg-orange-500/20 text-orange-300',
      'AI_COMMAND': 'bg-pink-500/20 text-pink-300',
      'LOGIN': 'bg-slate-500/20 text-slate-300'
    };
    return colors[action] || 'bg-slate-500/20 text-slate-300';
  };

  if (loading) {
    return (
      <div className="pt-20 min-h-screen bg-aikya">
        <div className="container mx-auto px-6 py-8">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <SkeletonBlock key={idx} className="h-10" />
              ))}
            </div>
            <div className="mt-6 space-y-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <SkeletonBlock key={idx} className="h-12" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 min-h-screen bg-aikya">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            {isAdmin ? 'Audit Logs' : 'My Activity'}
          </h1>
          <p className="text-slate-400">
            {isAdmin ? 'Monitor all system activities and user actions' : 'View your account activity history'}
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
                  placeholder="Search actions..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Action Type
              </label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white focus:border-amber-400 focus:outline-none"
              >
                <option value="" className="bg-slate-900 text-slate-100">All Actions</option>
                <option value="CREATE_PIPELINE" className="bg-slate-900 text-slate-100">Create Pipeline</option>
                <option value="TRIGGER_DEPLOYMENT" className="bg-slate-900 text-slate-100">Trigger Deployment</option>
                <option value="PROVISION_RESOURCE" className="bg-slate-900 text-slate-100">Provision Resource</option>
                <option value="SCALE_RESOURCE" className="bg-slate-900 text-slate-100">Scale Resource</option>
                <option value="AI_COMMAND" className="bg-slate-900 text-slate-100">AI Command</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-between items-center gap-3 mt-6">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleSearch}
                className="flex items-center space-x-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
              >
                <Filter className="h-4 w-4" />
                <span>Apply Filters</span>
              </button>
              <button
                onClick={handleClearFilters}
                className="flex items-center space-x-2 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
              >
                <X className="h-4 w-4" />
                <span>Clear</span>
              </button>
            </div>

            {isAdmin && (
              <button
                onClick={exportLogs}
                className="flex items-center space-x-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Export</span>
              </button>
            )}
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-medium text-slate-300">Timestamp</th>
                  {isAdmin && <th className="px-6 py-4 text-left text-sm font-medium text-slate-300">User</th>}
                  <th className="px-6 py-4 text-left text-sm font-medium text-slate-300">Action</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-slate-300">Resource</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-slate-300">Details</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-300">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-sm text-slate-300">
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-slate-400" />
                          <span>{log.user_email}</span>
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      <div>
                        <div className="font-medium">{log.resource_type}</div>
                        <div className="text-xs text-slate-500">{log.resource_id}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      <div className="max-w-xs truncate">
                        {JSON.stringify(log.details)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-1 text-slate-400 hover:text-white transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredLogs.length === 0 && (
            <div className="px-6 py-6">
              <EmptyState
                title="No audit logs found"
                message="Try adjusting your filters or check back once new activity is recorded."
              />
            </div>
          )}

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
            <div className="text-sm text-slate-400">
              {pagination.total === 0
                ? 'Showing 0 results'
                : `Showing ${((pagination.page - 1) * pagination.limit) + 1} to ${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total} results`}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page === 1}
                className="px-3 py-1 bg-slate-600 text-white rounded hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page * pagination.limit >= pagination.total}
                className="px-3 py-1 bg-slate-600 text-white rounded hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {selectedLog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 rounded-2xl border border-white/20 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Audit Details</h2>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 space-y-4 text-sm text-slate-300">
                {(() => {
                  const details = parseDetails(selectedLog.details);
                  return (
                    <>
                      <div>
                        <span className="text-slate-400">Timestamp:</span>{' '}
                        {new Date(selectedLog.created_at).toLocaleString()}
                      </div>
                      {isAdmin && (
                        <div>
                          <span className="text-slate-400">User:</span> {selectedLog.user_email}
                        </div>
                      )}
                      <div>
                        <span className="text-slate-400">Action:</span> {selectedLog.action}
                      </div>
                      <div>
                        <span className="text-slate-400">Resource:</span>{' '}
                        {selectedLog.resource_type} #{selectedLog.resource_id}
                      </div>
                      <div>
                        <span className="text-slate-400">IP Address:</span> {selectedLog.ip_address}
                      </div>
                      <div>
                        <span className="text-slate-400">Details:</span>
                        {details && typeof details === 'object' ? (
                          <div className="mt-2 space-y-2">
                            {Object.entries(details).map(([key, value]) => (
                              <div key={key} className="flex items-start gap-2">
                                <span className="text-slate-500 min-w-[140px]">{key}</span>
                                <span className="text-slate-200 break-all">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <pre className="mt-2 bg-black/30 p-4 rounded-lg text-xs text-slate-200 overflow-x-auto">
                            {details ? JSON.stringify(details, null, 2) : 'No additional details.'}
                          </pre>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogsPage;

