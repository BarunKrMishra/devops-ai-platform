import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Mail, Users, PlayCircle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import SkeletonBlock from '../ui/SkeletonBlock';
import BusinessNav from './BusinessNav';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type Metrics = {
  emails_today: number;
  new_leads: number;
  active_automations: number;
  lead_pipeline: Record<string, number>;
};

type Automation = {
  id: number;
  name: string;
  type: string;
  status: string;
  last_run_status?: string | null;
  last_run_at?: string | null;
};

type Lead = {
  id: number;
  name: string | null;
  email: string | null;
  company: string | null;
  status: string;
  score: number | null;
};

const MetricCard: React.FC<{ label: string; value: number; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="glass rounded-2xl p-5 border border-white/10">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-slate-400">{label}</p>
        <p className="text-2xl font-semibold text-white mt-2">{value}</p>
      </div>
      <div className="p-3 rounded-xl bg-amber-500/20 text-amber-200">
        {icon}
      </div>
    </div>
  </div>
);

const BusinessDashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [metricsRes, automationsRes, leadsRes] = await Promise.all([
        axios.get(`${API_URL}/api/business/metrics`),
        axios.get(`${API_URL}/api/business/automations?limit=5`),
        axios.get(`${API_URL}/api/business/leads?limit=5`)
      ]);
      setMetrics(metricsRes.data);
      setAutomations(automationsRes.data);
      setLeads(leadsRes.data);
    } catch (err) {
      console.error('Failed to load business overview:', err);
      setError('Unable to load business data right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="pt-20 min-h-screen">
      <div className="container mx-auto px-6 py-8">
        <BusinessNav />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-display text-white">Business Automation</h1>
            <p className="text-slate-400 mt-2">
              Track customer ops, lead flow, and automation health alongside your DevOps workflows.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/business/automation-builder"
              className="px-4 py-2 rounded-lg bg-amber-500/30 text-amber-100 hover:bg-amber-500/40 transition"
            >
              Build automation
            </Link>
            <Link
              to="/business/integrations"
              className="px-4 py-2 rounded-lg bg-white/10 text-slate-200 hover:bg-white/20 transition"
            >
              Connect tools
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[0, 1, 2].map((key) => (
              <div key={key} className="glass rounded-2xl p-5 border border-white/10">
                <SkeletonBlock className="h-4 w-1/2 mb-4" />
                <SkeletonBlock className="h-8 w-1/3" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {error && (
              <div className="glass rounded-xl p-4 text-red-200 border border-red-500/30 mb-6">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <MetricCard label="Emails processed today" value={metrics?.emails_today || 0} icon={<Mail className="h-5 w-5" />} />
              <MetricCard label="New leads today" value={metrics?.new_leads || 0} icon={<Users className="h-5 w-5" />} />
              <MetricCard label="Active automations" value={metrics?.active_automations || 0} icon={<PlayCircle className="h-5 w-5" />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass rounded-2xl p-6 border border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white">Recent automations</h2>
                  <Link to="/business/automations" className="text-sm text-amber-200 hover:text-amber-100">
                    View all
                  </Link>
                </div>
                {automations.length === 0 ? (
                  <p className="text-slate-400">No automations created yet.</p>
                ) : (
                  <div className="space-y-3">
                    {automations.map((automation) => (
                      <div key={automation.id} className="bg-slate-900/60 rounded-xl p-4 border border-white/5">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-slate-400 uppercase tracking-wide">{automation.type}</p>
                            <p className="text-lg text-white font-semibold">{automation.name}</p>
                          </div>
                          <div className="text-sm text-slate-300">
                            {automation.last_run_status ? `Last run: ${automation.last_run_status}` : 'No runs yet'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass rounded-2xl p-6 border border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white">Priority leads</h2>
                  <Link to="/business/leads" className="text-sm text-amber-200 hover:text-amber-100">
                    View pipeline
                  </Link>
                </div>
                {leads.length === 0 ? (
                  <p className="text-slate-400">No leads captured yet.</p>
                ) : (
                  <div className="space-y-3">
                    {leads.map((lead) => (
                      <div key={lead.id} className="bg-slate-900/60 rounded-xl p-4 border border-white/5">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white font-semibold">{lead.name || lead.email || 'Unnamed lead'}</p>
                            <p className="text-sm text-slate-400">{lead.company || 'Company unknown'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-slate-300">{lead.status}</p>
                            <p className="text-sm text-emerald-300">Score: {lead.score ?? 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Link
                  to="/business/leads"
                  className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white mt-4"
                >
                  Manage leads <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BusinessDashboardPage;
