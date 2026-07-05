import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { PlayCircle, PlusCircle, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import BusinessNav from './BusinessNav';
import SkeletonBlock from '../ui/SkeletonBlock';
import { getApiErrorMessage } from '../../utils/apiError';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type Automation = {
  id: number;
  name: string;
  type: string;
  status: string;
  last_run_status?: string | null;
  last_run_at?: string | null;
};

const BusinessAutomationsPage: React.FC = () => {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [running, setRunning] = useState<Record<number, boolean>>({});
  const [message, setMessage] = useState('');

  const fetchAutomations = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_URL}/api/business/automations`);
      setAutomations(response.data);
    } catch (err) {
      console.error('Failed to load automations:', err);
      setError('Unable to load automations right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAutomations();
  }, []);

  const runAutomation = async (automationId: number) => {
    setMessage('');
    setRunning((prev) => ({ ...prev, [automationId]: true }));
    try {
      await axios.post(`${API_URL}/api/business/automations/${automationId}/execute`, {
        source: 'manual'
      });
      setMessage('Automation executed successfully.');
      fetchAutomations();
    } catch (err) {
      console.error('Automation run failed:', err);
      setMessage(getApiErrorMessage(err, 'Failed to execute automation.'));
    } finally {
      setRunning((prev) => ({ ...prev, [automationId]: false }));
    }
  };

  return (
    <div className="pt-20 min-h-screen">
      <div className="container mx-auto px-6 py-8">
        <BusinessNav />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display text-white">Automations</h1>
            <p className="text-slate-400 mt-2">
              Manage workflows that classify emails, score leads, and sync CRM updates.
            </p>
          </div>
          <Link
            to="/business/automation-builder"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/30 text-amber-100 hover:bg-amber-500/40 transition"
          >
            <PlusCircle className="h-4 w-4" />
            Create automation
          </Link>
        </div>

        {message && (
          <div className="glass rounded-xl p-4 border border-white/10 text-slate-200 mb-6">
            {message}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[0, 1, 2].map((key) => (
              <div key={key} className="glass rounded-2xl p-6 border border-white/10">
                <SkeletonBlock className="h-5 w-1/3 mb-3" />
                <SkeletonBlock className="h-4 w-1/2 mb-2" />
                <SkeletonBlock className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {error && (
              <div className="glass rounded-xl p-4 border border-red-500/30 text-red-200 mb-6">
                {error}
              </div>
            )}

            {automations.length === 0 ? (
              <div className="glass rounded-2xl p-6 border border-white/10 text-slate-300">
                No automations yet. Build your first workflow to get started.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {automations.map((automation) => (
                  <div key={automation.id} className="glass rounded-2xl p-6 border border-white/10">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{automation.type}</p>
                        <h2 className="text-xl font-semibold text-white mt-2">{automation.name}</h2>
                        <p className="text-sm text-slate-300 mt-2">
                          Status: <span className="text-emerald-300">{automation.status}</span>
                        </p>
                      </div>
                      <button
                        onClick={() => runAutomation(automation.id)}
                        disabled={running[automation.id]}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/30 text-emerald-100 hover:bg-emerald-500/40 transition disabled:opacity-60"
                      >
                        {running[automation.id] ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <PlayCircle className="h-4 w-4" />
                        )}
                        Run now
                      </button>
                    </div>
                    <div className="mt-4 text-sm text-slate-400">
                      {automation.last_run_status
                        ? `Last run: ${automation.last_run_status} (${automation.last_run_at || 'recent'})`
                        : 'No runs recorded yet.'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BusinessAutomationsPage;
