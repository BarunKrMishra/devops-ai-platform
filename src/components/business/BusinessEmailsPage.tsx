import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { MailPlus, RefreshCw } from 'lucide-react';
import BusinessNav from './BusinessNav';
import SkeletonBlock from '../ui/SkeletonBlock';
import { getApiErrorMessage } from '../../utils/apiError';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type EmailLog = {
  id: number;
  from_address: string | null;
  to_address: string | null;
  subject: string | null;
  body: string | null;
  classification: string | null;
  ai_score: number | null;
  processed_at: string;
};

const BusinessEmailsPage: React.FC = () => {
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [syncError, setSyncError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [form, setForm] = useState({
    from_address: '',
    to_address: '',
    subject: '',
    body: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchEmails = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_URL}/api/business/emails`);
      setEmails(response.data);
    } catch (err) {
      console.error('Failed to load emails:', err);
      setError('Unable to load emails right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, []);

  const updateForm = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const submitEmail = async () => {
    setSubmitting(true);
    setMessage('');
    setError('');
    try {
      const response = await axios.post(`${API_URL}/api/business/emails`, {
        ...form,
        auto_classify: true
      });
      setMessage(`Email logged. Classification: ${response.data?.classification || 'N/A'}`);
      setForm({ from_address: '', to_address: '', subject: '', body: '' });
      fetchEmails();
    } catch (err) {
      console.error('Failed to log email:', err);
      setError(getApiErrorMessage(err, 'Failed to log email.'));
    } finally {
      setSubmitting(false);
    }
  };

  const syncGmail = async () => {
    setSyncMessage('');
    setSyncError('');
    setSyncing(true);
    try {
      const response = await axios.post(`${API_URL}/api/business/emails/sync`, { limit: 25 });
      const synced = response.data?.synced ?? 0;
      const reason = response.data?.reason;
      if (synced === 0 && reason === 'no_unseen_messages') {
        setSyncMessage('No new unread Gmail messages found.');
      } else {
        setSyncMessage(`Synced ${synced} Gmail messages.`);
      }
      fetchEmails();
    } catch (err) {
      console.error('Failed to sync Gmail inbox:', err);
      setSyncError(getApiErrorMessage(err, 'Failed to sync Gmail inbox.'));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="pt-20 min-h-screen">
      <div className="container mx-auto px-6 py-8">
        <BusinessNav />

        <div className="mb-6">
          <h1 className="text-3xl font-display text-white">Email Triage</h1>
          <p className="text-slate-400 mt-2">
            Log inbound emails and let Aikya classify intent for automation routing.
          </p>
        </div>

        <div className="glass rounded-2xl p-6 border border-white/10 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 text-amber-200">
              <MailPlus className="h-4 w-4" />
              <span className="text-sm uppercase tracking-[0.3em]">Log email</span>
            </div>
            <button
              onClick={syncGmail}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-slate-200 hover:bg-white/20 transition disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing inbox...' : 'Sync Gmail inbox'}
            </button>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Sync pulls unread Gmail messages from the connected integration and classifies them automatically.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              className="p-3 rounded-lg bg-slate-900/70 border border-white/10 text-slate-100"
              placeholder="From address"
              value={form.from_address}
              onChange={(event) => updateForm('from_address', event.target.value)}
            />
            <input
              className="p-3 rounded-lg bg-slate-900/70 border border-white/10 text-slate-100"
              placeholder="To address"
              value={form.to_address}
              onChange={(event) => updateForm('to_address', event.target.value)}
            />
            <input
              className="p-3 rounded-lg bg-slate-900/70 border border-white/10 text-slate-100"
              placeholder="Subject"
              value={form.subject}
              onChange={(event) => updateForm('subject', event.target.value)}
            />
            <input
              className="p-3 rounded-lg bg-slate-900/70 border border-white/10 text-slate-100"
              placeholder="Short body summary"
              value={form.body}
              onChange={(event) => updateForm('body', event.target.value)}
            />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={submitEmail}
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-emerald-500/30 text-emerald-100 hover:bg-emerald-500/40 transition disabled:opacity-60"
            >
              {submitting ? 'Processing...' : 'Classify email'}
            </button>
            {message && <span className="text-emerald-200 text-sm">{message}</span>}
            {error && <span className="text-red-200 text-sm">{error}</span>}
          </div>
          {(syncMessage || syncError) && (
            <div className="mt-3 text-sm">
              {syncMessage && <span className="text-emerald-200">{syncMessage}</span>}
              {syncError && <span className="text-red-200">{syncError}</span>}
            </div>
          )}
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
        ) : emails.length === 0 ? (
          <div className="glass rounded-2xl p-6 border border-white/10 text-slate-300">
            No emails logged yet. Submit a sample above to see classifications.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {emails.map((email) => (
              <div key={email.id} className="glass rounded-2xl p-5 border border-white/10">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white">{email.subject || 'No subject'}</h2>
                    <p className="text-sm text-slate-400">
                      {email.from_address || 'Unknown sender'}{' -> '}{email.to_address || 'Unknown recipient'}
                    </p>
                    {email.body && <p className="text-sm text-slate-300 mt-2">{email.body}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-amber-200">{email.classification || 'Unclassified'}</p>
                    <p className="text-sm text-emerald-300">Score: {email.ai_score ?? 'N/A'}</p>
                    <p className="text-xs text-slate-500 mt-1">{email.processed_at}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BusinessEmailsPage;
