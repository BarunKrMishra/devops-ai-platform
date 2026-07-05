import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { PlusCircle } from 'lucide-react';
import BusinessNav from './BusinessNav';
import SkeletonBlock from '../ui/SkeletonBlock';
import { getApiErrorMessage } from '../../utils/apiError';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type Lead = {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  budget: number | null;
  score: number | null;
  status: string;
  source: string | null;
  notes: string | null;
};

const statusOptions = ['new', 'contacted', 'qualified', 'won', 'lost'];

const BusinessLeadsPage: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    company: '',
    budget: '',
    source: '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const fetchLeads = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_URL}/api/business/leads`);
      setLeads(response.data);
    } catch (err) {
      console.error('Failed to load leads:', err);
      setError('Unable to load leads right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const updateForm = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const createLead = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await axios.post(`${API_URL}/api/business/leads`, {
        name: form.name || undefined,
        email: form.email || undefined,
        company: form.company || undefined,
        budget: form.budget ? Number(form.budget) : undefined,
        source: form.source || undefined,
        notes: form.notes || undefined
      });
      setForm({ name: '', email: '', company: '', budget: '', source: '', notes: '' });
      setMessage('Lead created.');
      fetchLeads();
    } catch (err) {
      console.error('Failed to create lead:', err);
      setError(getApiErrorMessage(err, 'Failed to create lead.'));
    } finally {
      setSaving(false);
    }
  };

  const updateLeadStatus = async (leadId: number, status: string) => {
    setError('');
    try {
      await axios.patch(`${API_URL}/api/business/leads/${leadId}`, { status });
      setLeads((prev) =>
        prev.map((lead) => (lead.id === leadId ? { ...lead, status } : lead))
      );
    } catch (err) {
      console.error('Failed to update lead status:', err);
      setError(getApiErrorMessage(err, 'Failed to update lead status.'));
    }
  };

  return (
    <div className="pt-20 min-h-screen">
      <div className="container mx-auto px-6 py-8">
        <BusinessNav />

        <div className="mb-6">
          <h1 className="text-3xl font-display text-white">Leads</h1>
          <p className="text-slate-400 mt-2">
            Capture inbound demand, score intent, and track pipeline health.
          </p>
        </div>

        <div className="glass rounded-2xl p-6 border border-white/10 mb-8">
          <div className="flex items-center gap-2 text-amber-200 mb-4">
            <PlusCircle className="h-4 w-4" />
            <span className="text-sm uppercase tracking-[0.3em]">New lead</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              className="p-3 rounded-lg bg-slate-900/70 border border-white/10 text-slate-100"
              placeholder="Name"
              value={form.name}
              onChange={(event) => updateForm('name', event.target.value)}
            />
            <input
              className="p-3 rounded-lg bg-slate-900/70 border border-white/10 text-slate-100"
              placeholder="Email"
              value={form.email}
              onChange={(event) => updateForm('email', event.target.value)}
            />
            <input
              className="p-3 rounded-lg bg-slate-900/70 border border-white/10 text-slate-100"
              placeholder="Company"
              value={form.company}
              onChange={(event) => updateForm('company', event.target.value)}
            />
            <input
              className="p-3 rounded-lg bg-slate-900/70 border border-white/10 text-slate-100"
              placeholder="Budget"
              value={form.budget}
              onChange={(event) => updateForm('budget', event.target.value)}
            />
            <input
              className="p-3 rounded-lg bg-slate-900/70 border border-white/10 text-slate-100"
              placeholder="Source"
              value={form.source}
              onChange={(event) => updateForm('source', event.target.value)}
            />
            <input
              className="p-3 rounded-lg bg-slate-900/70 border border-white/10 text-slate-100"
              placeholder="Notes"
              value={form.notes}
              onChange={(event) => updateForm('notes', event.target.value)}
            />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={createLead}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-emerald-500/30 text-emerald-100 hover:bg-emerald-500/40 transition disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Add lead'}
            </button>
            {message && <span className="text-emerald-200 text-sm">{message}</span>}
            {error && <span className="text-red-200 text-sm">{error}</span>}
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((key) => (
              <div key={key} className="glass rounded-2xl p-5 border border-white/10">
                <SkeletonBlock className="h-4 w-1/3 mb-2" />
                <SkeletonBlock className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className="glass rounded-2xl p-6 border border-white/10 text-slate-300">
            No leads yet. Add one above to start tracking your pipeline.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {leads.map((lead) => (
              <div key={lead.id} className="glass rounded-2xl p-5 border border-white/10">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {lead.name || lead.email || 'Unnamed lead'}
                    </h2>
                    <p className="text-sm text-slate-400">
                      {lead.company || 'Company unknown'} • {lead.email || 'No email'}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      Budget: {lead.budget ?? 'N/A'} • Source: {lead.source || 'N/A'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <select
                      className="px-3 py-2 rounded-lg bg-slate-900/70 border border-white/10 text-slate-100"
                      value={lead.status}
                      onChange={(event) => updateLeadStatus(lead.id, event.target.value)}
                    >
                      {statusOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <span className="text-sm text-emerald-300">Score: {lead.score ?? 'N/A'}</span>
                  </div>
                </div>
                {lead.notes && <p className="text-sm text-slate-300 mt-3">{lead.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BusinessLeadsPage;
