import express from 'express';
import { db } from '../database/init.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get audit logs (admin only)
router.get('/logs', requireRole(['admin']), async (req, res) => {
  try {
    const { page = 1, limit = 50, userId, action, startDate, endDate } = req.query;
    const offset = (page - 1) * limit;
    const organizationId = req.user.organization_id;

    let query = `
      SELECT al.*, u.email as user_email 
      FROM audit_logs al 
      JOIN users u ON al.user_id = u.id 
      WHERE al.organization_id = ?
    `;
    const params = [organizationId];

    if (userId) {
      query += ` AND al.user_id = ?`;
      params.push(userId);
    }

    if (action) {
      query += ` AND al.action LIKE ?`;
      params.push(`%${action}%`);
    }

    if (startDate) {
      query += ` AND al.created_at >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND al.created_at <= ?`;
      params.push(endDate);
    }

    query += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const logs = db.prepare(query).all(...params).map((log) => ({
      ...log,
      details: (() => {
        try {
          return log.details ? JSON.parse(log.details) : null;
        } catch (error) {
          return log.details;
        }
      })()
    }));

    // Get total count
    let countQuery = 'SELECT COUNT(*) as count FROM audit_logs WHERE organization_id = ?';
    const countParams = [organizationId];
    if (userId) {
      countQuery += ` AND user_id = ?`;
      countParams.push(userId);
    }
    if (action) {
      countQuery += ` AND action LIKE ?`;
      countParams.push(`%${action}%`);
    }
    if (startDate) {
      countQuery += ` AND created_at >= ?`;
      countParams.push(startDate);
    }
    if (endDate) {
      countQuery += ` AND created_at <= ?`;
      countParams.push(endDate);
    }
    const countResult = db.prepare(countQuery).get(...countParams);
    const totalCount = countResult.count;

    res.json({
      logs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
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
    const offset = (page - 1) * limit;

    const logs = db.prepare(
      'SELECT * FROM audit_logs WHERE user_id = ? AND organization_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(userId, organizationId, Number(limit), Number(offset))
      .map((log) => ({
        ...log,
        details: (() => {
          try {
            return log.details ? JSON.parse(log.details) : null;
          } catch (error) {
            return log.details;
          }
        })()
      }));

    const countResult = db.prepare(
      'SELECT COUNT(*) as count FROM audit_logs WHERE user_id = ? AND organization_id = ?'
    ).get(userId, organizationId);

    res.json({
      logs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: countResult.count
      }
    });
  } catch (error) {
    console.error('User audit logs fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get audit statistics
router.get('/stats', requireRole(['admin']), async (req, res) => {
  try {
    const { timeframe = '7d' } = req.query;
    const organizationId = req.user.organization_id;

    // SQLite doesn't support INTERVAL, so use date('now', '-X days')
    let dateFilter = '';
    switch (timeframe) {
      case '24h':
        dateFilter = "datetime(created_at) >= datetime('now', '-1 day')";
        break;
      case '7d':
        dateFilter = "datetime(created_at) >= datetime('now', '-7 days')";
        break;
      case '30d':
        dateFilter = "datetime(created_at) >= datetime('now', '-30 days')";
        break;
      default:
        dateFilter = "datetime(created_at) >= datetime('now', '-7 days')";
    }

    // Get action counts
    const actionStats = db.prepare(`
      SELECT action, COUNT(*) as count 
      FROM audit_logs 
      WHERE organization_id = ? AND ${dateFilter}
      GROUP BY action 
      ORDER BY count DESC
    `).all(organizationId);

    // Get user activity
    const userStats = db.prepare(`
      SELECT u.email, COUNT(al.id) as action_count
      FROM users u
      LEFT JOIN audit_logs al ON u.id = al.user_id AND al.organization_id = ? AND ${dateFilter.replace('created_at', 'al.created_at')}
      WHERE u.organization_id = ?
      GROUP BY u.id, u.email
      ORDER BY action_count DESC
      LIMIT 10
    `).all(organizationId, organizationId);

    // Get daily activity
    const dailyStats = db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM audit_logs
      WHERE organization_id = ? AND ${dateFilter}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `).all(organizationId);

    res.json({
      actionStats,
      userStats,
      dailyStats
    });
  } catch (error) {
    console.error('Audit stats error:', error);
    res.status(500).json({ error: 'Failed to fetch audit statistics' });
  }
});

// Export audit logs to CSV (admin only)
router.get('/export', requireRole(['admin']), async (req, res) => {
  try {
    const { action, startDate, endDate } = req.query;
    const organizationId = req.user.organization_id;

    let query = `
      SELECT al.*, u.email as user_email
      FROM audit_logs al
      JOIN users u ON al.user_id = u.id
      WHERE al.organization_id = ?
    `;
    const params = [organizationId];

    if (action) {
      query += ` AND al.action LIKE ?`;
      params.push(`%${action}%`);
    }
    if (startDate) {
      query += ` AND al.created_at >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND al.created_at <= ?`;
      params.push(endDate);
    }

    query += ' ORDER BY al.created_at DESC';

    const logs = db.prepare(query).all(...params);

    const header = ['timestamp', 'user_email', 'action', 'resource_type', 'resource_id', 'ip_address', 'details'];
    const rows = logs.map((log) => [
      log.created_at,
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
    res.setHeader('Content-Disposition', 'attachment; filename=\"audit-logs.csv\"');
    res.send(csv);
  } catch (error) {
    console.error('Audit export error:', error);
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
});

export default router;
