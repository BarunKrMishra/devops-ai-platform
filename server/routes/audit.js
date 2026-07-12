import express from 'express';
import { Op, fn, col } from 'sequelize';
import { AuditLog, User } from '../models/index.js';
import { dayBucket } from '../database/sequelize.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

const buildDateFilter = (startDate, endDate) => {
  const filter = {};
  if (startDate) {
    filter[Op.gte] = new Date(startDate);
  }
  if (endDate) {
    filter[Op.lte] = new Date(endDate);
  }
  return Object.keys(filter).length ? filter : null;
};

const mapUsers = async (logs) => {
  const userIds = Array.from(new Set(logs.map((log) => log.user_id).filter(Boolean)));
  const users = userIds.length
    ? await User.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ['id', 'email', 'name'], raw: true })
    : [];
  const userMap = users.reduce((acc, user) => {
    acc[user.id] = user;
    return acc;
  }, {});

  return logs.map((log) => ({
    ...log,
    user_email: userMap[log.user_id]?.email || null,
    user_name: userMap[log.user_id]?.name || null
  }));
};

// Get audit logs (admin/manager)
router.get('/logs', requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { page = 1, limit = 50, userId, action, startDate, endDate } = req.query;
    const organizationId = req.user.organization_id;

    const query = { organization_id: organizationId };
    if (userId) {
      query.user_id = userId;
    }
    if (action) {
      query.action = { [Op.like]: `%${String(action)}%` };
    }
    const dateFilter = buildDateFilter(startDate, endDate);
    if (dateFilter) {
      query.created_at = dateFilter;
    }

    const offset = (Number(page) - 1) * Number(limit);

    const [logs, totalCount] = await Promise.all([
      AuditLog.findAll({
        where: query,
        order: [['created_at', 'DESC']],
        offset,
        limit: Number(limit),
        raw: true
      }),
      AuditLog.count({ where: query })
    ]);

    const mappedLogs = await mapUsers(logs);

    res.json({
      logs: mappedLogs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / Number(limit))
      }
    });
  } catch (error) {
    console.error('Audit logs fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get user's own audit logs
router.get('/my-logs', async (req, res) => {
  try {
    const userId = req.user.id;
    const organizationId = req.user.organization_id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const [logs, totalCount] = await Promise.all([
      AuditLog.findAll({
        where: { user_id: userId, organization_id: organizationId },
        order: [['created_at', 'DESC']],
        offset,
        limit: Number(limit),
        raw: true
      }),
      AuditLog.count({ where: { user_id: userId, organization_id: organizationId } })
    ]);

    const mappedLogs = await mapUsers(logs);

    res.json({
      logs: mappedLogs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount
      }
    });
  } catch (error) {
    console.error('User audit logs fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get audit statistics
router.get('/stats', requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { timeframe = '7d' } = req.query;
    const organizationId = req.user.organization_id;

    let startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (timeframe === '24h') {
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    } else if (timeframe === '30d') {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const actionStats = await AuditLog.findAll({
      where: { organization_id: organizationId, created_at: { [Op.gte]: startDate } },
      attributes: ['action', [fn('COUNT', col('id')), 'count']],
      group: ['action'],
      order: [[fn('COUNT', col('id')), 'DESC']],
      raw: true
    });

    const userStatsRaw = await AuditLog.findAll({
      where: { organization_id: organizationId, created_at: { [Op.gte]: startDate } },
      attributes: ['user_id', [fn('COUNT', col('id')), 'action_count']],
      group: ['user_id'],
      order: [[fn('COUNT', col('id')), 'DESC']],
      limit: 10,
      raw: true
    });

    const userIds = userStatsRaw.map((row) => row.user_id).filter(Boolean);
    const users = userIds.length
      ? await User.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ['id', 'email', 'name'], raw: true })
      : [];
    const userMap = users.reduce((acc, user) => {
      acc[user.id] = user;
      return acc;
    }, {});

    const userStats = userStatsRaw.map((row) => ({
      email: userMap[row.user_id]?.email || null,
      name: userMap[row.user_id]?.name || null,
      action_count: Number(row.action_count)
    }));

    const dateExpr = dayBucket('created_at');
    const dailyStats = await AuditLog.findAll({
      where: { organization_id: organizationId, created_at: { [Op.gte]: startDate } },
      attributes: [[dateExpr, 'date'], [fn('COUNT', col('id')), 'count']],
      group: [dateExpr],
      order: [[dateExpr, 'DESC']],
      raw: true
    });

    res.json({
      actionStats: actionStats.map((item) => ({ action: item.action, count: Number(item.count) })),
      userStats,
      dailyStats: dailyStats.map((row) => ({ date: row.date, count: Number(row.count) }))
    });
  } catch (error) {
    console.error('Audit stats error:', error);
    res.status(500).json({ error: 'Failed to fetch audit statistics' });
  }
});

// Export audit logs to CSV (admin/manager)
router.get('/export', requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { action, startDate, endDate } = req.query;
    const organizationId = req.user.organization_id;

    const query = { organization_id: organizationId };
    if (action) {
      query.action = { [Op.like]: `%${String(action)}%` };
    }
    const dateFilter = buildDateFilter(startDate, endDate);
    if (dateFilter) {
      query.created_at = dateFilter;
    }

    const logs = await AuditLog.findAll({
      where: query,
      order: [['created_at', 'DESC']],
      raw: true
    });

    const mappedLogs = await mapUsers(logs);

    const header = ['timestamp', 'user_name', 'user_email', 'action', 'resource_type', 'resource_id', 'ip_address', 'details'];
    const rows = mappedLogs.map((log) => [
      log.created_at,
      log.user_name,
      log.user_email,
      log.action,
      log.resource_type,
      log.resource_id,
      log.ip_address,
      JSON.stringify(log.details || {})
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Audit export error:', error);
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
});

export default router;
