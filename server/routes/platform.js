import express from 'express';
import { Op, fn, col } from 'sequelize';
import {
  Organization,
  User,
  OrganizationOps,
  OpsModule,
  Integration,
  GoLiveRequest,
  OpsPurchaseRequest,
  AuditLog,
  LoginAttempt,
  PageView,
  PlatformAdmin
} from '../models/index.js';
import { requireRootAdmin, isRootAdmin } from '../middleware/platform.js';

// Every route here is cross-organization and is mounted behind
// authenticateToken + requirePlatformAdmin, so only the Aikya team can reach it.
const router = express.Router();

const ALLOWED_ROLES = ['admin', 'manager', 'developer', 'viewer', 'user'];
const DAY_MS = 24 * 60 * 60 * 1000;
const fmtDay = (d) => new Date(d).toISOString().slice(0, 10);

// Lightweight check the frontend uses to decide whether to show the admin panel.
router.get('/access', (req, res) => {
  res.json({ platform_admin: true, is_root: isRootAdmin(req.user), email: req.user.email });
});

// High-level platform metrics.
router.get('/overview', async (req, res) => {
  try {
    const [
      organizations,
      users,
      activeUsers,
      activeIntegrations,
      pendingGoLive,
      pendingPurchases,
      enabledOps
    ] = await Promise.all([
      Organization.count(),
      User.count(),
      User.count({ where: { is_active: true } }),
      Integration.count({ where: { is_active: true } }),
      GoLiveRequest.count({ where: { status: 'pending' } }),
      OpsPurchaseRequest.count({ where: { status: 'pending' } }),
      OrganizationOps.count({ where: { enabled: true } })
    ]);

    res.json({
      organizations,
      users,
      active_users: activeUsers,
      active_integrations: activeIntegrations,
      pending_go_live: pendingGoLive,
      pending_purchases: pendingPurchases,
      enabled_ops: enabledOps
    });
  } catch (error) {
    console.error('Platform overview error:', error);
    res.status(500).json({ error: 'Failed to load platform overview.' });
  }
});

// All customer organizations with at-a-glance stats.
router.get('/organizations', async (req, res) => {
  try {
    const organizations = await Organization.findAll({
      order: [['created_at', 'DESC']],
      raw: true
    });

    const enriched = await Promise.all(
      organizations.map(async (org) => {
        const [memberCount, activeMembers, ops, integrationCount, pendingRequests] = await Promise.all([
          User.count({ where: { organization_id: org.id } }),
          User.count({ where: { organization_id: org.id, is_active: true } }),
          OrganizationOps.findAll({ where: { organization_id: org.id, enabled: true }, attributes: ['module_key'], raw: true }),
          Integration.count({ where: { organization_id: org.id, is_active: true } }),
          GoLiveRequest.count({ where: { organization_id: org.id, status: 'pending' } })
        ]);

        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          plan: org.plan,
          seat_limit: org.seat_limit,
          demo_mode: undefined, // demo mode lives in onboarding settings; shown in detail
          member_count: memberCount,
          active_members: activeMembers,
          enabled_ops: ops.map((row) => row.module_key),
          integration_count: integrationCount,
          pending_requests: pendingRequests,
          created_at: org.created_at
        };
      })
    );

    res.json(enriched);
  } catch (error) {
    console.error('Platform organizations error:', error);
    res.status(500).json({ error: 'Failed to load organizations.' });
  }
});

// Full detail for one customer organization.
router.get('/organizations/:id', async (req, res) => {
  try {
    const orgId = req.params.id;
    const organization = await Organization.findByPk(orgId, { raw: true });
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found.' });
    }

    const [modules, orgOps, members, integrations, goLive, purchases, audit] = await Promise.all([
      OpsModule.findAll({ order: [['category', 'ASC'], ['name', 'ASC']], raw: true }),
      OrganizationOps.findAll({ where: { organization_id: orgId }, raw: true }),
      User.findAll({
        where: { organization_id: orgId },
        attributes: ['id', 'email', 'name', 'role', 'is_active', 'permissions', 'last_login', 'created_at'],
        order: [['role', 'ASC'], ['created_at', 'ASC']],
        raw: true
      }),
      // Never expose credentials — only the connection metadata.
      Integration.findAll({
        where: { organization_id: orgId },
        attributes: ['id', 'type', 'name', 'is_active', 'last_sync', 'created_at'],
        order: [['type', 'ASC']],
        raw: true
      }),
      GoLiveRequest.findAll({ where: { organization_id: orgId }, order: [['created_at', 'DESC']], raw: true }),
      OpsPurchaseRequest.findAll({ where: { organization_id: orgId }, order: [['created_at', 'DESC']], raw: true }),
      AuditLog.findAll({ where: { organization_id: orgId }, order: [['created_at', 'DESC']], limit: 25, raw: true })
    ]);

    const opsByKey = orgOps.reduce((acc, row) => {
      acc[row.module_key] = row;
      return acc;
    }, {});

    res.json({
      organization,
      ops: modules.map((module) => ({
        key: module.key,
        name: module.name,
        category: module.category,
        enabled: Boolean(opsByKey[module.key]?.enabled),
        configured: Boolean(opsByKey[module.key]?.configured)
      })),
      members: members.map((member) => ({
        ...member,
        permissions: member.permissions || {}
      })),
      integrations,
      go_live_requests: goLive,
      purchase_requests: purchases,
      recent_activity: audit
    });
  } catch (error) {
    console.error('Platform organization detail error:', error);
    res.status(500).json({ error: 'Failed to load organization detail.' });
  }
});

// Enable / disable an ops suite for a customer (grant or revoke a purchased suite).
router.patch('/organizations/:id/ops/:key', async (req, res) => {
  try {
    const orgId = req.params.id;
    const moduleKey = req.params.key;
    const { enabled, configured } = req.body || {};

    const [org, module] = await Promise.all([
      Organization.findByPk(orgId),
      OpsModule.findOne({ where: { key: moduleKey } })
    ]);
    if (!org) return res.status(404).json({ error: 'Organization not found.' });
    if (!module) return res.status(404).json({ error: 'Ops module not found.' });

    const existing = await OrganizationOps.findOne({ where: { organization_id: orgId, module_key: moduleKey } });
    const nextEnabled = enabled !== undefined ? Boolean(enabled) : Boolean(existing?.enabled);
    const nextConfigured = configured !== undefined ? Boolean(configured) : Boolean(existing?.configured);

    if (existing) {
      await OrganizationOps.update(
        { enabled: nextEnabled, configured: nextConfigured },
        { where: { organization_id: orgId, module_key: moduleKey } }
      );
    } else {
      await OrganizationOps.create({
        organization_id: orgId,
        module_key: moduleKey,
        enabled: nextEnabled,
        configured: nextConfigured
      });
    }

    res.json({ key: moduleKey, enabled: nextEnabled, configured: nextConfigured });
  } catch (error) {
    console.error('Platform ops toggle error:', error);
    res.status(500).json({ error: 'Failed to update ops module.' });
  }
});

// Change any user's role (cross-org platform power).
router.patch('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body || {};
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    await User.update({ role }, { where: { id: req.params.id } });
    res.json({ id: Number(req.params.id), role });
  } catch (error) {
    console.error('Platform user role error:', error);
    res.status(500).json({ error: 'Failed to update user role.' });
  }
});

// Grant / revoke a user's per-suite ops access.
router.patch('/users/:id/ops-access', async (req, res) => {
  try {
    const { ops_access } = req.body || {};
    if (ops_access !== null && !Array.isArray(ops_access)) {
      return res.status(400).json({ error: 'ops_access must be an array or null.' });
    }

    const user = await User.findByPk(req.params.id, { raw: true });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    let normalized = null;
    if (Array.isArray(ops_access)) {
      const rows = await OpsModule.findAll({ attributes: ['key'], raw: true });
      const allowed = rows.map((row) => row.key);
      normalized = ops_access.map((item) => String(item)).filter((key) => allowed.includes(key));
    }

    const permissions = user.permissions || {};
    if (normalized === null) {
      delete permissions.ops_access;
    } else {
      permissions.ops_access = normalized;
    }

    await User.update({ permissions }, { where: { id: req.params.id } });
    res.json({ id: Number(req.params.id), permissions });
  } catch (error) {
    console.error('Platform user ops-access error:', error);
    res.status(500).json({ error: 'Failed to update user access.' });
  }
});

// Everything customers are currently asking for, across all orgs.
router.get('/requests', async (req, res) => {
  try {
    const [goLive, purchases, orgs] = await Promise.all([
      GoLiveRequest.findAll({ where: { status: 'pending' }, order: [['created_at', 'DESC']], raw: true }),
      OpsPurchaseRequest.findAll({ where: { status: 'pending' }, order: [['created_at', 'DESC']], raw: true }),
      Organization.findAll({ attributes: ['id', 'name'], raw: true })
    ]);
    const orgName = orgs.reduce((acc, o) => { acc[o.id] = o.name; return acc; }, {});

    res.json({
      go_live: goLive.map((r) => ({ ...r, organization_name: orgName[r.organization_id] || `Org ${r.organization_id}` })),
      purchases: purchases.map((r) => ({ ...r, organization_name: orgName[r.organization_id] || `Org ${r.organization_id}` }))
    });
  } catch (error) {
    console.error('Platform requests error:', error);
    res.status(500).json({ error: 'Failed to load requests.' });
  }
});

// Approve / reject an ops purchase request.
router.patch('/purchase-requests/:id', async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    const request = await OpsPurchaseRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found.' });

    await OpsPurchaseRequest.update({ status }, { where: { id: req.params.id } });
    res.json({ id: Number(req.params.id), status });
  } catch (error) {
    console.error('Platform purchase request error:', error);
    res.status(500).json({ error: 'Failed to update request.' });
  }
});

// Recent activity across the whole platform.
router.get('/audit', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 300);
    const [logs, orgs] = await Promise.all([
      AuditLog.findAll({ order: [['created_at', 'DESC']], limit, raw: true }),
      Organization.findAll({ attributes: ['id', 'name'], raw: true })
    ]);
    const orgName = orgs.reduce((acc, o) => { acc[o.id] = o.name; return acc; }, {});

    res.json(
      logs.map((log) => ({
        id: log.id,
        action: log.action,
        resource_type: log.resource_type,
        resource_id: log.resource_id,
        organization_id: log.organization_id,
        organization_name: orgName[log.organization_id] || null,
        user_id: log.user_id,
        ip_address: log.ip_address,
        created_at: log.created_at
      }))
    );
  } catch (error) {
    console.error('Platform audit error:', error);
    res.status(500).json({ error: 'Failed to load activity.' });
  }
});

// ---------------------------------------------------------------------------
// USER ANALYTICS — every person, whether new / returning / paying, with the
// details the sales team needs (email, signup, logins, visits, last IP).
// ---------------------------------------------------------------------------
router.get('/users', async (req, res) => {
  try {
    const [users, orgs, loginAgg, recentAttempts, visitAgg, enabledOps, goLive, purchases] = await Promise.all([
      User.findAll({
        attributes: ['id', 'email', 'name', 'role', 'is_active', 'organization_id', 'last_login', 'created_at'],
        order: [['created_at', 'DESC']],
        raw: true
      }),
      Organization.findAll({ attributes: ['id', 'name'], raw: true }),
      LoginAttempt.findAll({
        attributes: ['email', [fn('COUNT', col('id')), 'total'], [fn('MAX', col('timestamp')), 'last']],
        group: ['email'],
        raw: true
      }),
      // Most-recent login attempts to derive last-seen IP per email.
      LoginAttempt.findAll({ attributes: ['email', 'ip_address', 'timestamp'], order: [['timestamp', 'DESC']], limit: 4000, raw: true }),
      PageView.findAll({
        attributes: ['user_id', [fn('COUNT', col('id')), 'total'], [fn('MAX', col('created_at')), 'last']],
        where: { user_id: { [Op.ne]: null } },
        group: ['user_id'],
        raw: true
      }),
      OrganizationOps.findAll({ where: { enabled: true }, attributes: ['organization_id'], raw: true }),
      GoLiveRequest.findAll({ attributes: ['organization_id'], raw: true }),
      OpsPurchaseRequest.findAll({ attributes: ['organization_id'], raw: true })
    ]);

    const orgName = orgs.reduce((a, o) => { a[o.id] = o.name; return a; }, {});
    const loginByEmail = loginAgg.reduce((a, r) => { a[r.email] = { total: Number(r.total), last: r.last }; return a; }, {});
    const ipByEmail = {};
    for (const row of recentAttempts) {
      if (row.email && !ipByEmail[row.email] && row.ip_address) ipByEmail[row.email] = row.ip_address;
    }
    const visitByUser = visitAgg.reduce((a, r) => { a[r.user_id] = { total: Number(r.total), last: r.last }; return a; }, {});
    const customerOrgs = new Set([
      ...enabledOps.map((r) => r.organization_id),
      ...goLive.map((r) => r.organization_id),
      ...purchases.map((r) => r.organization_id)
    ]);

    const now = Date.now();
    const payload = users.map((u) => {
      const logins = loginByEmail[u.email] || { total: 0, last: null };
      const visits = visitByUser[u.id] || { total: 0, last: null };
      const isCustomer = customerOrgs.has(u.organization_id);
      const signupMs = u.created_at ? new Date(u.created_at).getTime() : now;
      const hasLoggedIn = Boolean(u.last_login);
      let status = 'new';
      if (isCustomer) status = 'customer';
      else if (hasLoggedIn) status = 'active';
      else if (now - signupMs < 3 * DAY_MS) status = 'new';
      else status = 'dormant';

      return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        is_active: u.is_active,
        organization_id: u.organization_id,
        organization_name: orgName[u.organization_id] || null,
        signup_at: u.created_at,
        last_login: u.last_login,
        login_count: logins.total,
        visit_count: visits.total,
        last_visit: visits.last,
        last_ip: ipByEmail[u.email] || null,
        is_customer: isCustomer,
        status
      };
    });

    res.json(payload);
  } catch (error) {
    console.error('Platform users error:', error);
    res.status(500).json({ error: 'Failed to load users.' });
  }
});

// Deep detail for one person: full login & visit history, activity, requests.
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: ['id', 'email', 'name', 'role', 'is_active', 'organization_id', 'permissions', 'last_login', 'created_at'],
      raw: true
    });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const [org, logins, visits, activity, purchases, goLive] = await Promise.all([
      Organization.findByPk(user.organization_id, { attributes: ['id', 'name', 'plan'], raw: true }),
      LoginAttempt.findAll({ where: { email: user.email }, order: [['timestamp', 'DESC']], limit: 50, raw: true }),
      PageView.findAll({ where: { [Op.or]: [{ user_id: user.id }, { email: user.email }] }, order: [['created_at', 'DESC']], limit: 100, raw: true }),
      AuditLog.findAll({ where: { user_id: user.id }, order: [['created_at', 'DESC']], limit: 50, raw: true }),
      OpsPurchaseRequest.findAll({ where: { organization_id: user.organization_id }, order: [['created_at', 'DESC']], raw: true }),
      GoLiveRequest.findAll({ where: { organization_id: user.organization_id }, order: [['created_at', 'DESC']], raw: true })
    ]);

    const pathCounts = visits.reduce((a, v) => { a[v.path || '/'] = (a[v.path || '/'] || 0) + 1; return a; }, {});
    const topPages = Object.entries(pathCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([path, count]) => ({ path, count }));

    res.json({
      user: { ...user, permissions: user.permissions || {} },
      organization: org,
      login_history: logins,
      visit_history: visits.slice(0, 40),
      visit_count: visits.length,
      top_pages: topPages,
      activity: activity,
      purchase_requests: purchases,
      go_live_requests: goLive
    });
  } catch (error) {
    console.error('Platform user detail error:', error);
    res.status(500).json({ error: 'Failed to load user detail.' });
  }
});

// Platform-wide analytics overview.
router.get('/analytics', async (req, res) => {
  try {
    const now = Date.now();
    const dayAgo = new Date(now - DAY_MS);
    const weekAgo = new Date(now - 7 * DAY_MS);

    const fortnightAgo = new Date(now - 14 * DAY_MS);
    const [totalUsers, newWeek, activeToday, loginsToday, viewsToday, uniqueVisitorsToday, signups, recentViews,
           allUsers, enabledOps, goLive, purchases, viewsTrendRows, loginsTrendRows] = await Promise.all([
      User.count(),
      User.count({ where: { created_at: { [Op.gte]: weekAgo } } }),
      User.count({ where: { last_login: { [Op.gte]: dayAgo } } }),
      LoginAttempt.count({ where: { success: true, timestamp: { [Op.gte]: dayAgo } } }),
      PageView.count({ where: { created_at: { [Op.gte]: dayAgo } } }),
      PageView.findAll({ where: { created_at: { [Op.gte]: dayAgo } }, attributes: [[fn('COUNT', fn('DISTINCT', col('session_id'))), 'c']], raw: true }),
      User.findAll({ where: { created_at: { [Op.gte]: fortnightAgo } }, attributes: ['created_at'], raw: true }),
      PageView.findAll({ where: { created_at: { [Op.gte]: weekAgo } }, attributes: ['path'], raw: true }),
      User.findAll({ attributes: ['role', 'organization_id', 'last_login', 'created_at'], raw: true }),
      OrganizationOps.findAll({ where: { enabled: true }, attributes: ['organization_id'], raw: true }),
      GoLiveRequest.findAll({ attributes: ['organization_id'], raw: true }),
      OpsPurchaseRequest.findAll({ attributes: ['organization_id'], raw: true }),
      PageView.findAll({ where: { created_at: { [Op.gte]: fortnightAgo } }, attributes: ['created_at'], raw: true }),
      LoginAttempt.findAll({ where: { success: true, timestamp: { [Op.gte]: fortnightAgo } }, attributes: ['timestamp'], raw: true })
    ]);

    // Signups per day (last 14 days).
    const trend = {};
    for (let i = 13; i >= 0; i--) trend[fmtDay(now - i * DAY_MS)] = 0;
    signups.forEach((s) => { const d = fmtDay(s.created_at); if (d in trend) trend[d] += 1; });
    const signupTrend = Object.entries(trend).map(([date, count]) => ({ date, count }));

    // Views vs logins per day (last 14 days) — two series, one shared count axis.
    const days = [];
    for (let i = 13; i >= 0; i--) days.push(fmtDay(now - i * DAY_MS));
    const viewsByDay = Object.fromEntries(days.map((d) => [d, 0]));
    const loginsByDay = Object.fromEntries(days.map((d) => [d, 0]));
    viewsTrendRows.forEach((v) => { const d = fmtDay(v.created_at); if (d in viewsByDay) viewsByDay[d] += 1; });
    loginsTrendRows.forEach((l) => { const d = fmtDay(l.timestamp); if (d in loginsByDay) loginsByDay[d] += 1; });
    const activityTrend = days.map((date) => ({ date, views: viewsByDay[date], logins: loginsByDay[date] }));

    // Top pages (last 7 days).
    const pageCounts = recentViews.reduce((a, v) => { const p = v.path || '/'; a[p] = (a[p] || 0) + 1; return a; }, {});
    const topPages = Object.entries(pageCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([path, count]) => ({ path, count }));

    // Status + role breakdown (composition).
    const customerOrgs = new Set([
      ...enabledOps.map((r) => r.organization_id),
      ...goLive.map((r) => r.organization_id),
      ...purchases.map((r) => r.organization_id)
    ]);
    const statusBreakdown = { new: 0, active: 0, customer: 0, dormant: 0 };
    const roleBreakdown = {};
    allUsers.forEach((u) => {
      roleBreakdown[u.role] = (roleBreakdown[u.role] || 0) + 1;
      const signupMs = u.created_at ? new Date(u.created_at).getTime() : now;
      if (customerOrgs.has(u.organization_id)) statusBreakdown.customer += 1;
      else if (u.last_login) statusBreakdown.active += 1;
      else if (now - signupMs < 3 * DAY_MS) statusBreakdown.new += 1;
      else statusBreakdown.dormant += 1;
    });

    res.json({
      total_users: totalUsers,
      new_this_week: newWeek,
      active_today: activeToday,
      logins_today: loginsToday,
      views_today: viewsToday,
      unique_visitors_today: Number(uniqueVisitorsToday?.[0]?.c || 0),
      signup_trend: signupTrend,
      activity_trend: activityTrend,
      top_pages: topPages,
      status_breakdown: statusBreakdown,
      role_breakdown: Object.entries(roleBreakdown).map(([role, count]) => ({ role, count })).sort((a, b) => b.count - a.count)
    });
  } catch (error) {
    console.error('Platform analytics error:', error);
    res.status(500).json({ error: 'Failed to load analytics.' });
  }
});

// Live activity feed across the whole platform (logins, page views, actions).
router.get('/activity', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 60, 200);
    const [logins, views, actions, orgs] = await Promise.all([
      LoginAttempt.findAll({ order: [['timestamp', 'DESC']], limit, raw: true }),
      PageView.findAll({ order: [['created_at', 'DESC']], limit, raw: true }),
      AuditLog.findAll({ order: [['created_at', 'DESC']], limit, raw: true }),
      Organization.findAll({ attributes: ['id', 'name'], raw: true })
    ]);
    const orgName = orgs.reduce((a, o) => { a[o.id] = o.name; return a; }, {});

    const feed = [
      ...logins.map((l) => ({ type: l.success ? 'login' : 'login_failed', at: l.timestamp, email: l.email, ip: l.ip_address, detail: l.success ? 'Signed in' : 'Failed sign-in' })),
      ...views.map((v) => ({ type: 'visit', at: v.created_at, email: v.email || 'anonymous', ip: v.ip_address, detail: `Viewed ${v.path || '/'}`, organization_name: orgName[v.organization_id] || null })),
      ...actions.map((a) => ({ type: 'action', at: a.created_at, email: null, ip: a.ip_address, detail: a.action, organization_name: orgName[a.organization_id] || null, user_id: a.user_id }))
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, limit);

    res.json(feed);
  } catch (error) {
    console.error('Platform activity error:', error);
    res.status(500).json({ error: 'Failed to load activity.' });
  }
});

// ---------------------------------------------------------------------------
// TEAM ADMIN MANAGEMENT (root admins only) — grow the Aikya team.
// ---------------------------------------------------------------------------
router.get('/admins', async (req, res) => {
  try {
    const rootEmails = String(process.env.PLATFORM_ADMIN_EMAILS || '')
      .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    const team = await PlatformAdmin.findAll({ order: [['created_at', 'ASC']], raw: true });
    res.json({
      root: rootEmails.map((email) => ({ email, tier: 'root' })),
      team: team.map((t) => ({ id: t.id, email: t.email, name: t.name, added_by: t.added_by, created_at: t.created_at, tier: 'team' })),
      can_manage: isRootAdmin(req.user)
    });
  } catch (error) {
    console.error('Platform admins list error:', error);
    res.status(500).json({ error: 'Failed to load admins.' });
  }
});

router.post('/admins', requireRootAdmin, async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const name = req.body?.name ? String(req.body.name).trim() : null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'A valid email is required.' });
    }
    const rootEmails = String(process.env.PLATFORM_ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase());
    if (rootEmails.includes(email)) {
      return res.status(400).json({ error: 'That email is already a root admin.' });
    }
    const [record, created] = await PlatformAdmin.findOrCreate({
      where: { email },
      defaults: { email, name, added_by: req.user.email }
    });
    res.json({ id: record.id, email: record.email, name: record.name, created });
  } catch (error) {
    console.error('Platform admin add error:', error);
    res.status(500).json({ error: 'Failed to add admin.' });
  }
});

router.delete('/admins/:id', requireRootAdmin, async (req, res) => {
  try {
    const removed = await PlatformAdmin.destroy({ where: { id: req.params.id } });
    if (!removed) return res.status(404).json({ error: 'Admin not found.' });
    res.json({ removed: true });
  } catch (error) {
    console.error('Platform admin remove error:', error);
    res.status(500).json({ error: 'Failed to remove admin.' });
  }
});

export default router;
