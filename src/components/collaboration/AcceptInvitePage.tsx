
import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const AcceptInvitePage: React.FC = () => {
  const location = useLocation();
  const token = new URLSearchParams(location.search).get('token');
  const [loading, setLoading] = useState(true);
  const [inviteInfo, setInviteInfo] = useState<{ email: string; role: string; organization_name: string } | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ name: '', password: '', confirm: '' });

  useEffect(() => {
    const fetchInvite = async () => {
      if (!token) {
        setError('Invite token is missing.');
        setLoading(false);
        return;
      }
      try {
        const response = await axios.get(`${API_URL}/api/invites/${token}`);
        setInviteInfo(response.data);
      } catch (err) {
        setError('Invite link is invalid or has expired.');
      } finally {
        setLoading(false);
      }
    };

    fetchInvite();
  }, [token]);

  const handleSubmit = async () => {
    setError('');
    if (!form.password || form.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }

    try {
      await axios.post(`${API_URL}/api/invites/accept`, {
        token,
        name: form.name,
        password: form.password
      });
      setSuccess('Invite accepted. You can now sign in.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to accept invite.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-aikya flex items-center justify-center px-6">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-aikya flex items-center justify-center px-6 py-16">
      <div className="max-w-lg w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8">
        <h1 className="text-2xl font-semibold text-white">Join {inviteInfo?.organization_name || 'Aikya'}</h1>
        <p className="text-slate-400 text-sm mt-2">
          Accept the invite to access your organization workspace.
        </p>

        {error && (
          <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {success}
          </div>
        )}

        {!success && inviteInfo && (
          <div className="mt-6 space-y-4">
            <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              <p><span className="text-slate-400">Invited email:</span> {inviteInfo.email}</p>
              <p className="mt-1"><span className="text-slate-400">Role:</span> {inviteInfo.role}</p>
            </div>

            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
              placeholder="Full name (optional)"
            />
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              className="w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
              placeholder="Create a password"
            />
            <input
              type="password"
              value={form.confirm}
              onChange={(event) => setForm((prev) => ({ ...prev, confirm: event.target.value }))}
              className="w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
              placeholder="Confirm password"
            />
            <button
              onClick={handleSubmit}
              className="w-full px-4 py-3 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
            >
              Accept invite
            </button>
          </div>
        )}

        {success && (
          <div className="mt-6 text-sm text-slate-300">
            <Link to="/login" className="text-amber-300 hover:text-amber-200">
              Continue to login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default AcceptInvitePage;
