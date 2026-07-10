import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Building2, Users, ShieldCheck, Activity, Check, X, ArrowLeft,
  Inbox, Loader2, Search, LineChart, UserCog, LogIn, Eye, Trash2, Plus, Globe, Download, RefreshCw
} from 'lucide-react';
import { usePlatformAdmin } from '../../hooks/usePlatformAdmin';
import { getApiErrorMessage } from '../../utils/apiError';
import { TrendChart, DonutChart, BarRows, STATUS_COLORS, SERIES_COLORS } from './charts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/* ---------- types ---------- */
interface Overview { organizations: number; users: number; active_integrations: number; enabled_ops: number; pending_go_live: number; pending_purchases: number; }
interface Analytics {
  total_users: number; new_this_week: number; active_today: number; logins_today: number; views_today: number; unique_visitors_today: number;
  signup_trend: { date: string; count: number }[];
  activity_trend: { date: string; views: number; logins: number }[];
  top_pages: { path: string; count: number }[];
  status_breakdown: { new: number; active: number; customer: number; dormant: number };
  role_breakdown: { role: string; count: number }[];
}
interface UserRow { id: number; email: string; name: string | null; role: string; is_active: boolean; organization_name: string | null; signup_at: string; last_login: string | null; login_count: number; visit_count: number; last_visit: string | null; last_ip: string | null; is_customer: boolean; status: string; }
interface UserDetail { user: UserRow & { permissions: { ops_access?: string[] } }; organization: { id: number; name: string; plan: string } | null; login_history: { id: number; success: boolean; ip_address: string | null; timestamp: string }[]; visit_history: { id: number; path: string | null; referrer: string | null; ip_address: string | null; created_at: string }[]; visit_count: number; top_pages: { path: string; count: number }[]; activity: { id: number; action: string; created_at: string }[]; purchase_requests: { id: number; module_key?: string; status: string }[]; go_live_requests: { id: number; status: string }[]; }
interface ActivityItem { type: string; at: string; email: string | null; ip: string | null; detail: string; organization_name?: string | null; }
interface OrgRow { id: number; name: string; slug: string; plan: string; member_count: number; active_members: number; enabled_ops: string[]; integration_count: number; pending_requests: number; }
interface Member { id: number; email: string; name: string | null; role: string; is_active: boolean; permissions: { ops_access?: string[] }; last_login: string | null; }
interface OpsRow { key: string; name: string; category: string; enabled: boolean; configured: boolean; }
interface IntegrationRow { id: number; type: string; is_active: boolean; last_sync: string | null; }
interface RequestRow { id: number; organization_id: number; organization_name?: string; module_key?: string; status: string; contact_email?: string; requirements_notes?: string; notes?: string; }
interface OrgDetail { organization: { id: number; name: string; plan: string; seat_limit: number; created_at: string }; ops: OpsRow[]; members: Member[]; integrations: IntegrationRow[]; go_live_requests: RequestRow[]; purchase_requests: RequestRow[]; recent_activity: { id: number; action: string; created_at: string }[]; }
interface AdminsData { root: { email: string }[]; team: { id: number; email: string; name: string | null; added_by: string | null; created_at: string }[]; can_manage: boolean; }

const ROLES = ['admin', 'manager', 'developer', 'viewer'];
const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString() : '—');
const fmtTime = (v?: string | null) => (v ? new Date(v).toLocaleString() : '—');

const STATUS_STYLE: Record<string, string> = {
  customer: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30',
  active: 'bg-sky-500/20 text-sky-200 border-sky-500/30',
  new: 'bg-amber-500/20 text-amber-200 border-amber-500/30',
  dormant: 'bg-slate-500/20 text-slate-300 border-slate-500/30'
};

const Tile: React.FC<{ icon: React.ElementType; label: string; value: React.ReactNode; accent?: string }> = ({ icon: Icon, label, value, accent = 'text-amber-300' }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
    <div className="flex items-center justify-between">
      <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</span>
      <Icon className={`h-4 w-4 ${accent}`} />
    </div>
    <div className="mt-2 text-3xl font-semibold text-white">{value}</div>
  </div>
);

const TABS = [
  { key: 'overview', label: 'Overview', icon: LineChart },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'customers', label: 'Customers', icon: Building2 },
  { key: 'activity', label: 'Activity', icon: Activity },
  { key: 'team', label: 'Team', icon: UserCog }
] as const;

const AikyaAdminPage: React.FC = () => {
  const isAdmin = usePlatformAdmin();
  const [tab, setTab] = useState<string>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const [overview, setOverview] = useState<Overview | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [requests, setRequests] = useState<{ go_live: RequestRow[]; purchases: RequestRow[] }>({ go_live: [], purchases: [] });

  const [users, setUsers] = useState<UserRow[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);

  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [orgSearch, setOrgSearch] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<number | null>(null);
  const [orgDetail, setOrgDetail] = useState<OrgDetail | null>(null);
  const [orgDetailLoading, setOrgDetailLoading] = useState(false);

  const [feed, setFeed] = useState<ActivityItem[]>([]);
  const [admins, setAdmins] = useState<AdminsData | null>(null);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');

  const authed = (url: string) => axios.get(url).then((r) => r.data);

  useEffect(() => {
    if (isAdmin !== true) { if (isAdmin === false) setLoading(false); return; }
    (async () => {
      try {
        const [ov, an, rq] = await Promise.all([
          authed(`${API_URL}/api/platform/overview`),
          authed(`${API_URL}/api/platform/analytics`),
          authed(`${API_URL}/api/platform/requests`)
        ]);
        setOverview(ov); setAnalytics(an); setRequests(rq);
      } catch (err) { setError(getApiErrorMessage(err, 'Failed to load platform data.')); }
      finally { setLoading(false); }
    })();
  }, [isAdmin]);

  // Lazy-load per tab.
  useEffect(() => {
    if (isAdmin !== true) return;
    if (tab === 'users' && users.length === 0) authed(`${API_URL}/api/platform/users`).then(setUsers).catch(() => {});
    if (tab === 'customers' && orgs.length === 0) authed(`${API_URL}/api/platform/organizations`).then(setOrgs).catch(() => {});
    if (tab === 'activity') authed(`${API_URL}/api/platform/activity?limit=80`).then(setFeed).catch(() => {});
    if (tab === 'team' && !admins) authed(`${API_URL}/api/platform/admins`).then(setAdmins).catch(() => {});
  }, [tab, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live auto-refresh of the activity feed every 12s while that tab is open.
  useEffect(() => {
    if (isAdmin !== true || tab !== 'activity') return;
    const id = setInterval(() => {
      axios.get(`${API_URL}/api/platform/activity?limit=80`).then((r) => setFeed(r.data)).catch(() => {});
    }, 12000);
    return () => clearInterval(id);
  }, [tab, isAdmin]);

  const openUser = async (id: number) => {
    setUserDetailLoading(true); setUserDetail(null);
    try { setUserDetail(await authed(`${API_URL}/api/platform/users/${id}`)); }
    catch (err) { setError(getApiErrorMessage(err, 'Failed to load user.')); }
    finally { setUserDetailLoading(false); }
  };

  const openOrg = async (id: number) => {
    setSelectedOrg(id); setOrgDetail(null); setOrgDetailLoading(true);
    try { setOrgDetail(await authed(`${API_URL}/api/platform/organizations/${id}`)); }
    catch (err) { setError(getApiErrorMessage(err, 'Failed to load customer.')); }
    finally { setOrgDetailLoading(false); }
  };

  const toggleOps = async (orgId: number, key: string, enabled: boolean) => {
    setBusy(`ops-${key}`);
    try { await axios.patch(`${API_URL}/api/platform/organizations/${orgId}/ops/${key}`, { enabled }); await openOrg(orgId); }
    catch (err) { setError(getApiErrorMessage(err, 'Failed to update ops.')); } finally { setBusy(''); }
  };
  const changeRole = async (userId: number, role: string) => {
    setBusy(`role-${userId}`);
    try { await axios.patch(`${API_URL}/api/platform/users/${userId}/role`, { role }); if (selectedOrg) await openOrg(selectedOrg); }
    catch (err) { setError(getApiErrorMessage(err, 'Failed to update role.')); } finally { setBusy(''); }
  };
  const decidePurchase = async (id: number, status: 'approved' | 'rejected') => {
    setBusy(`pr-${id}`);
    try {
      await axios.patch(`${API_URL}/api/platform/purchase-requests/${id}`, { status });
      const rq = await authed(`${API_URL}/api/platform/requests`); setRequests(rq);
    } catch (err) { setError(getApiErrorMessage(err, 'Failed to update request.')); } finally { setBusy(''); }
  };
  const addAdmin = async () => {
    setBusy('add-admin');
    try {
      await axios.post(`${API_URL}/api/platform/admins`, { email: newAdminEmail.trim(), name: newAdminName.trim() || undefined });
      setNewAdminEmail(''); setNewAdminName('');
      setAdmins(await authed(`${API_URL}/api/platform/admins`));
    } catch (err) { setError(getApiErrorMessage(err, 'Failed to add admin.')); } finally { setBusy(''); }
  };
  const removeAdmin = async (id: number) => {
    setBusy(`rm-${id}`);
    try { await axios.delete(`${API_URL}/api/platform/admins/${id}`); setAdmins(await authed(`${API_URL}/api/platform/admins`)); }
    catch (err) { setError(getApiErrorMessage(err, 'Failed to remove admin.')); } finally { setBusy(''); }
  };

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.email.toLowerCase().includes(q) || (u.name || '').toLowerCase().includes(q) || (u.organization_name || '').toLowerCase().includes(q));
  }, [users, userSearch]);

  const exportUsersCsv = () => {
    const headers = ['email', 'name', 'company', 'role', 'status', 'is_customer', 'logins', 'visits', 'last_ip', 'signup_at', 'last_login'];
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = filteredUsers.map((u) =>
      [u.email, u.name, u.organization_name, u.role, u.status, u.is_customer, u.login_count, u.visit_count, u.last_ip, u.signup_at, u.last_login].map(esc).join(',')
    );
    const csv = [headers.join(','), ...lines].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `aikya-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const filteredOrgs = useMemo(() => {
    const q = orgSearch.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter((o) => o.name.toLowerCase().includes(q));
  }, [orgs, orgSearch]);

  if (isAdmin === null || (isAdmin && loading)) {
    return <div className="min-h-screen bg-aikya flex items-center justify-center text-slate-300"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading Aikya admin…</div>;
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-aikya flex items-center justify-center px-6">
        <div className="max-w-md text-center glass rounded-2xl p-8 border border-white/10">
          <ShieldCheck className="h-8 w-8 text-amber-300 mx-auto" />
          <h1 className="text-2xl font-semibold text-white mt-4">Aikya team only</h1>
          <p className="text-slate-400 mt-2">This console is restricted to the Aikya platform team.</p>
          <Link to="/dashboard" className="inline-block mt-6 px-5 py-2.5 rounded-xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400">Back to app</Link>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-aikya text-slate-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/70 backdrop-blur">
        <div className="container mx-auto px-6 h-16 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-amber-500 to-teal-500" />
            <span className="font-semibold text-white">Aikya Admin</span>
            <span className="text-[0.65rem] uppercase tracking-[0.2em] text-amber-300 border border-amber-400/30 rounded-full px-2 py-0.5">Master</span>
          </div>
          <div className="flex-1" />
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to app</Link>
        </div>
        <div className="container mx-auto px-6 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition-colors whitespace-nowrap ${tab === t.key ? 'border-amber-400 text-amber-100' : 'border-transparent text-slate-400 hover:text-white'}`}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 space-y-6">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex items-center justify-between">
            <span>{error}</span>
            <button type="button" onClick={() => setError('')} aria-label="Dismiss"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* ===================== OVERVIEW ===================== */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Tile icon={Users} label="Total users" value={analytics?.total_users ?? '—'} />
              <Tile icon={Plus} label="New this week" value={analytics?.new_this_week ?? '—'} accent="text-emerald-300" />
              <Tile icon={LogIn} label="Active today" value={analytics?.active_today ?? '—'} accent="text-sky-300" />
              <Tile icon={Eye} label="Views today" value={analytics?.views_today ?? '—'} accent="text-teal-300" />
              <Tile icon={Globe} label="Visitors today" value={analytics?.unique_visitors_today ?? '—'} accent="text-violet-300" />
              <Tile icon={Building2} label="Customers" value={overview?.organizations ?? '—'} />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="glass rounded-2xl border border-white/10 p-6">
                <h3 className="text-sm uppercase tracking-[0.2em] text-slate-400 mb-4">New signups · last 14 days</h3>
                {analytics && (
                  <TrendChart labels={analytics.signup_trend.map((d) => d.date)}
                    series={[{ name: 'Signups', color: SERIES_COLORS[0], points: analytics.signup_trend.map((d) => d.count) }]} />
                )}
              </div>
              <div className="glass rounded-2xl border border-white/10 p-6">
                <h3 className="text-sm uppercase tracking-[0.2em] text-slate-400 mb-4">Engagement · views vs logins (14 days)</h3>
                {analytics && (
                  <TrendChart area={false} labels={analytics.activity_trend.map((d) => d.date)}
                    series={[
                      { name: 'Views', color: SERIES_COLORS[1], points: analytics.activity_trend.map((d) => d.views) },
                      { name: 'Logins', color: SERIES_COLORS[0], points: analytics.activity_trend.map((d) => d.logins) }
                    ]} />
                )}
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              <div className="glass rounded-2xl border border-white/10 p-6">
                <h3 className="text-sm uppercase tracking-[0.2em] text-slate-400 mb-4">User mix</h3>
                {analytics && (
                  <DonutChart centerLabel="users" segments={[
                    { label: 'customer', value: analytics.status_breakdown.customer, color: STATUS_COLORS.customer },
                    { label: 'active', value: analytics.status_breakdown.active, color: STATUS_COLORS.active },
                    { label: 'new', value: analytics.status_breakdown.new, color: STATUS_COLORS.new },
                    { label: 'dormant', value: analytics.status_breakdown.dormant, color: STATUS_COLORS.dormant }
                  ]} />
                )}
              </div>
              <div className="glass rounded-2xl border border-white/10 p-6">
                <h3 className="text-sm uppercase tracking-[0.2em] text-slate-400 mb-4">Top pages · last 7 days</h3>
                <BarRows color={SERIES_COLORS[1]} items={(analytics?.top_pages || []).map((p) => ({ label: p.path, value: p.count }))} />
              </div>
              <div className="glass rounded-2xl border border-white/10 p-6">
                <h3 className="text-sm uppercase tracking-[0.2em] text-slate-400 mb-4">Users by role</h3>
                <BarRows items={(analytics?.role_breakdown || []).map((r) => ({ label: r.role, value: r.count }))} />
              </div>
            </div>

            {/* pending requests */}
            <div className="glass rounded-2xl border border-white/10 p-6">
              <div className="flex items-center gap-2 mb-4"><Inbox className="h-5 w-5 text-amber-300" /><h3 className="text-lg font-semibold text-white">What customers are asking for</h3></div>
              {requests.purchases.length + requests.go_live.length === 0 ? <p className="text-sm text-slate-400">Nothing pending.</p> : (
                <div className="space-y-3">
                  {requests.purchases.map((r) => (
                    <div key={`pr-${r.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                      <p className="text-white"><span className="text-amber-300 text-xs uppercase mr-2">Purchase</span>{r.organization_name} wants <span className="font-mono text-teal-300">{r.module_key}</span></p>
                      <div className="flex gap-2">
                        <button type="button" disabled={busy === `pr-${r.id}`} onClick={() => decidePurchase(r.id, 'approved')} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 text-sm"><Check className="h-4 w-4" /> Approve</button>
                        <button type="button" disabled={busy === `pr-${r.id}`} onClick={() => decidePurchase(r.id, 'rejected')} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 text-slate-300 border border-white/10 text-sm"><X className="h-4 w-4" /> Reject</button>
                      </div>
                    </div>
                  ))}
                  {requests.go_live.map((r) => (
                    <div key={`gl-${r.id}`} className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <p className="text-white"><span className="text-teal-300 text-xs uppercase mr-2">Go-live</span>{r.organization_name}</p>
                      {r.contact_email && <p className="text-xs text-slate-500 mt-1">Contact: {r.contact_email}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== USERS ===================== */}
        {tab === 'users' && (
          <div className="grid lg:grid-cols-[1fr_400px] gap-6">
            <div className="glass rounded-2xl border border-white/10 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search by email, name, company…" aria-label="Search users"
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none" />
                </div>
                <span className="text-xs text-slate-500 hidden sm:inline">{filteredUsers.length} users</span>
                <button type="button" onClick={exportUsersCsv} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-200 hover:bg-white/10 shrink-0">
                  <Download className="h-4 w-4" /> CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead><tr className="text-xs uppercase tracking-wide text-slate-500 text-left">
                    <th className="py-2 pr-3">User</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Logins</th><th className="py-2 pr-3">Visits</th><th className="py-2 pr-3">Last IP</th><th className="py-2">Signup</th>
                  </tr></thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.id} onClick={() => openUser(u.id)} className={`border-t border-white/5 cursor-pointer hover:bg-white/5 ${userDetail?.user.id === u.id ? 'bg-amber-500/10' : ''}`}>
                        <td className="py-2.5 pr-3"><div className="text-white truncate max-w-[200px]">{u.name || u.email}</div><div className="text-xs text-slate-500 truncate max-w-[200px]">{u.email}</div></td>
                        <td className="py-2.5 pr-3"><span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLE[u.status] || STATUS_STYLE.dormant}`}>{u.status}</span></td>
                        <td className="py-2.5 pr-3 text-slate-300">{u.login_count}</td>
                        <td className="py-2.5 pr-3 text-slate-300">{u.visit_count}</td>
                        <td className="py-2.5 pr-3 font-mono text-xs text-slate-400">{u.last_ip || '—'}</td>
                        <td className="py-2.5 text-slate-400 text-xs">{fmtDate(u.signup_at)}</td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-500">No users match.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="glass rounded-2xl border border-white/10 p-5 h-fit">
              {!userDetail && !userDetailLoading && <p className="text-slate-400 text-sm">Select a person to see their full history — logins, visits, activity, and what their company is doing. Useful for sales to reach out.</p>}
              {userDetailLoading && <div className="text-slate-400 flex items-center"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…</div>}
              {userDetail && !userDetailLoading && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-white truncate">{userDetail.user.name || userDetail.user.email}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLE[userDetail.user.status] || STATUS_STYLE.dormant}`}>{userDetail.user.status}</span>
                    </div>
                    <a href={`mailto:${userDetail.user.email}`} className="text-sm text-amber-200 hover:underline break-all">{userDetail.user.email}</a>
                    <p className="text-xs text-slate-400 mt-1">{userDetail.organization?.name} · {userDetail.user.role} · joined {fmtDate(userDetail.user.signup_at)}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-white/5 border border-white/10 p-2"><div className="text-lg font-semibold text-white">{userDetail.user.login_count}</div><div className="text-[0.65rem] uppercase text-slate-500">logins</div></div>
                    <div className="rounded-lg bg-white/5 border border-white/10 p-2"><div className="text-lg font-semibold text-white">{userDetail.visit_count}</div><div className="text-[0.65rem] uppercase text-slate-500">visits</div></div>
                    <div className="rounded-lg bg-white/5 border border-white/10 p-2"><div className="text-lg font-semibold text-white">{(userDetail.purchase_requests.length + userDetail.go_live_requests.length)}</div><div className="text-[0.65rem] uppercase text-slate-500">requests</div></div>
                  </div>
                  <div>
                    <h4 className="text-xs uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1"><LogIn className="h-3 w-3" /> Recent logins</h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {userDetail.login_history.length === 0 && <p className="text-xs text-slate-500">No logins recorded.</p>}
                      {userDetail.login_history.slice(0, 8).map((l) => (
                        <div key={l.id} className="text-xs flex items-center justify-between gap-2">
                          <span className={l.success ? 'text-emerald-300' : 'text-red-300'}>{l.success ? 'success' : 'failed'} · <span className="font-mono text-slate-400">{l.ip_address || '—'}</span></span>
                          <span className="text-slate-500">{fmtTime(l.timestamp)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1"><Eye className="h-3 w-3" /> Recent visits</h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {userDetail.visit_history.length === 0 && <p className="text-xs text-slate-500">No visits tracked yet.</p>}
                      {userDetail.visit_history.slice(0, 8).map((v) => (
                        <div key={v.id} className="text-xs flex items-center justify-between gap-2">
                          <span className="font-mono text-slate-300 truncate">{v.path || '/'}</span>
                          <span className="text-slate-500 shrink-0">{fmtTime(v.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== CUSTOMERS ===================== */}
        {tab === 'customers' && (
          <div className="grid lg:grid-cols-[340px_1fr] gap-6">
            <div className="glass rounded-2xl border border-white/10 p-4 h-fit">
              <div className="relative mb-3">
                <Search className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input value={orgSearch} onChange={(e) => setOrgSearch(e.target.value)} placeholder="Search customers…" aria-label="Search customers"
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none" />
              </div>
              <div className="space-y-1 max-h-[560px] overflow-y-auto pr-1">
                {filteredOrgs.map((o) => (
                  <button key={o.id} type="button" onClick={() => openOrg(o.id)} className={`w-full text-left rounded-xl px-3 py-2.5 border transition-colors ${selectedOrg === o.id ? 'bg-amber-500/15 border-amber-400/30' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
                    <div className="flex items-center justify-between"><span className="font-medium text-white truncate">{o.name}</span>{o.pending_requests > 0 && <span className="text-[0.65rem] rounded-full bg-amber-500/20 text-amber-200 px-1.5 py-0.5">{o.pending_requests}</span>}</div>
                    <div className="text-xs text-slate-400 mt-0.5 flex gap-3"><span>{o.active_members}/{o.member_count} users</span><span>{o.enabled_ops.length} ops</span><span>{o.integration_count} tools</span></div>
                  </button>
                ))}
                {filteredOrgs.length === 0 && <p className="text-sm text-slate-500 px-2 py-3">No customers.</p>}
              </div>
            </div>
            <div className="glass rounded-2xl border border-white/10 p-6 min-h-[300px]">
              {!selectedOrg && <p className="text-slate-400">Select a customer to manage their ops suites, team roles, and see connected tools & requests.</p>}
              {selectedOrg && orgDetailLoading && <div className="text-slate-400 flex items-center"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…</div>}
              {orgDetail && !orgDetailLoading && (
                <div className="space-y-7">
                  <div><h2 className="text-2xl font-semibold text-white">{orgDetail.organization.name}</h2><p className="text-sm text-slate-400">Plan: {orgDetail.organization.plan} · Seats: {orgDetail.organization.seat_limit} · Since {fmtDate(orgDetail.organization.created_at)}</p></div>
                  <div>
                    <h3 className="text-sm uppercase tracking-[0.2em] text-slate-400 mb-3">Ops suites</h3>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {orgDetail.ops.map((o) => (
                        <div key={o.key} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                          <div><p className="text-white font-medium">{o.name}</p><p className="text-xs text-slate-500 font-mono">{o.key}</p></div>
                          <button type="button" disabled={busy === `ops-${o.key}`} onClick={() => toggleOps(orgDetail.organization.id, o.key, !o.enabled)} aria-label={`Toggle ${o.name}`}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${o.enabled ? 'bg-emerald-500' : 'bg-slate-600'}`}>
                            <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${o.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm uppercase tracking-[0.2em] text-slate-400 mb-3">Team</h3>
                    <div className="space-y-2">
                      {orgDetail.members.map((m) => (
                        <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                          <div className="min-w-0"><p className="text-white font-medium truncate">{m.name || m.email}</p><p className="text-xs text-slate-400 truncate">{m.email} · last login {fmtDate(m.last_login)}</p></div>
                          <select value={m.role} onChange={(e) => changeRole(m.id, e.target.value)} disabled={busy === `role-${m.id}`} aria-label={`Role for ${m.email}`} className="rounded-lg bg-white/10 border border-white/20 text-sm text-white px-2 py-1.5 focus:border-amber-400 focus:outline-none">
                            {ROLES.map((r) => <option key={r} value={r} className="bg-slate-900">{r}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm uppercase tracking-[0.2em] text-slate-400 mb-3">Connected tools</h3>
                    {orgDetail.integrations.length === 0 ? <p className="text-sm text-slate-500">None connected.</p> : (
                      <div className="flex flex-wrap gap-2">{orgDetail.integrations.map((i) => <span key={i.id} className={`text-xs font-mono px-2.5 py-1 rounded-full border ${i.is_active ? 'border-emerald-500/30 text-emerald-200' : 'border-white/10 text-slate-400'}`}>{i.type}</span>)}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== ACTIVITY ===================== */}
        {tab === 'activity' && (
          <div className="glass rounded-2xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-amber-300" />
                <h3 className="text-lg font-semibold text-white">Live activity</h3>
                <span className="inline-flex items-center gap-1.5 text-[0.65rem] uppercase tracking-wide text-emerald-300 ml-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> live · auto-refreshing
                </span>
              </div>
              <button type="button" onClick={() => axios.get(`${API_URL}/api/platform/activity?limit=80`).then((r) => setFeed(r.data)).catch(() => {})} className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
                <RefreshCw className="h-3.5 w-3.5" /> Refresh now
              </button>
            </div>
            <div className="space-y-1 max-h-[70vh] overflow-y-auto">
              {feed.length === 0 && <p className="text-sm text-slate-500">No recent activity.</p>}
              {feed.map((a, i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-2 border-b border-white/5 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-[0.6rem] uppercase tracking-wide px-2 py-0.5 rounded-full border shrink-0 ${a.type === 'login' ? 'text-emerald-200 border-emerald-500/30' : a.type === 'login_failed' ? 'text-red-200 border-red-500/30' : a.type === 'visit' ? 'text-sky-200 border-sky-500/30' : 'text-amber-200 border-amber-500/30'}`}>{a.type.replace('_', ' ')}</span>
                    <span className="text-slate-300 truncate">{a.detail}</span>
                    {a.email && <span className="text-slate-500 truncate hidden sm:inline">· {a.email}</span>}
                    {a.ip && <span className="text-slate-600 font-mono text-xs hidden md:inline">· {a.ip}</span>}
                  </div>
                  <span className="text-slate-500 text-xs shrink-0">{fmtTime(a.at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===================== TEAM ===================== */}
        {tab === 'team' && admins && (
          <div className="max-w-2xl space-y-6">
            <div className="glass rounded-2xl border border-white/10 p-6">
              <h3 className="text-lg font-semibold text-white mb-1">Aikya admin team</h3>
              <p className="text-sm text-slate-400 mb-4">Root admins are set in the server config and manage the team. {admins.can_manage ? 'You can add or remove team admins.' : 'Only root admins can change this.'}</p>
              <div className="space-y-2">
                {admins.root.map((r) => (
                  <div key={r.email} className="flex items-center justify-between rounded-xl border border-amber-400/20 bg-amber-500/5 px-4 py-3">
                    <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-amber-300" /><span className="text-white">{r.email}</span></div>
                    <span className="text-xs uppercase tracking-wide text-amber-300">root</span>
                  </div>
                ))}
                {admins.team.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                    <div><span className="text-white">{t.name || t.email}</span><span className="text-xs text-slate-500 ml-2">{t.email}</span><div className="text-xs text-slate-500">added by {t.added_by || '—'}</div></div>
                    {admins.can_manage && <button type="button" disabled={busy === `rm-${t.id}`} onClick={() => removeAdmin(t.id)} aria-label="Remove admin" className="p-2 text-slate-400 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                ))}
                {admins.team.length === 0 && <p className="text-sm text-slate-500">No team admins yet.</p>}
              </div>
            </div>
            {admins.can_manage && (
              <div className="glass rounded-2xl border border-white/10 p-6">
                <h3 className="text-sm uppercase tracking-[0.2em] text-slate-400 mb-3 flex items-center gap-2"><Plus className="h-4 w-4" /> Add a team admin</h3>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} placeholder="teammate@company.com" aria-label="New admin email" className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none" />
                  <input value={newAdminName} onChange={(e) => setNewAdminName(e.target.value)} placeholder="Name (optional)" aria-label="New admin name" className="sm:w-40 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none" />
                  <button type="button" disabled={busy === 'add-admin' || !newAdminEmail.trim()} onClick={addAdmin} className="px-4 py-2 rounded-lg bg-amber-500 text-slate-900 font-semibold text-sm hover:bg-amber-400 disabled:opacity-50">Add</button>
                </div>
                <p className="text-xs text-slate-500 mt-2">They get full platform access when they log in with this email. They must already have (or create) an Aikya account with it.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AikyaAdminPage;
