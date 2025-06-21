import express from 'express';
import { db } from '../database/init.js';
import { requireRole } from '../middleware/auth.js';
import { logAuditAction } from '../utils/audit.js';
import speakeasy from 'speakeasy';

const router = express.Router();

// Get organization details
router.get('/', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;

    const organization = db.prepare(`
      SELECT o.*, 
        COUNT(DISTINCT u.id) as member_count,
        COUNT(DISTINCT p.id) as project_count
      FROM organizations o
      LEFT JOIN users u ON o.id = u.organization_id AND u.is_active = 1
      LEFT JOIN projects p ON o.id = p.organization_id
      WHERE o.id = ?
      GROUP BY o.id
    `).get(organizationId);

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json({
      ...organization,
      settings: JSON.parse(organization.settings)
    });
  } catch (error) {
    console.error('Organization fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

// Update organization settings
router.put('/settings', requireRole(['admin']), async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const userId = req.user.id;
    const { name, billing_email, settings } = req.body;

    db.prepare(`
      UPDATE organizations 
      SET name = ?, billing_email = ?, settings = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, billing_email, JSON.stringify(settings), organizationId);

    await logAuditAction(userId, 'UPDATE_ORGANIZATION', 'organization', organizationId, {
      name,
      billing_email
    });

    res.json({ message: 'Organization updated successfully' });
  } catch (error) {
    console.error('Organization update error:', error);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// Get organization members
router.get('/members', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;

    const members = db.prepare(`
      SELECT id, email, name, role, last_login, is_active, created_at
      FROM users 
      WHERE organization_id = ?
      ORDER BY role, name
    `).all(organizationId);

    res.json(members);
  } catch (error) {
    console.error('Members fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Invite user to organization
router.post('/invite', requireRole(['admin']), async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const userId = req.user.id;
    const { email, role = 'developer' } = req.body;

    // Check if user already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create invitation (in production, send email invitation)
    const inviteToken = Math.random().toString(36).substring(2, 15);
    
    // For demo, create user directly
    const secret = speakeasy.generateSecret({ name: `DevOpsAI (${email})` });
    const result = db.prepare(`
      INSERT INTO users (email, role, organization_id, is_active, two_factor_secret)
      VALUES (?, ?, ?, 0, ?)
    `).run(email, role, organizationId, secret.base32);

    await logAuditAction(userId, 'INVITE_USER', 'user', result.lastInsertRowid, {
      email,
      role
    });

    res.json({ 
      message: 'User invited successfully',
      invite_token: inviteToken 
    });
  } catch (error) {
    console.error('User invitation error:', error);
    res.status(500).json({ error: 'Failed to invite user' });
  }
});

// Update member role
router.put('/members/:memberId/role', requireRole(['admin']), async (req, res) => {
  try {
    const { memberId } = req.params;
    const { role } = req.body;
    const organizationId = req.user.organization_id;
    const userId = req.user.id;

    // Verify member belongs to organization
    const member = db.prepare(`
      SELECT id, email FROM users 
      WHERE id = ? AND organization_id = ?
    `).get(memberId, organizationId);

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, memberId);

    await logAuditAction(userId, 'UPDATE_USER_ROLE', 'user', memberId, {
      email: member.email,
      new_role: role
    });

    res.json({ message: 'Member role updated successfully' });
  } catch (error) {
    console.error('Role update error:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

// Remove member from organization
router.delete('/members/:memberId', requireRole(['admin']), async (req, res) => {
  try {
    const { memberId } = req.params;
    const organizationId = req.user.organization_id;
    const userId = req.user.id;

    // Verify member belongs to organization
    const member = db.prepare(`
      SELECT id, email FROM users 
      WHERE id = ? AND organization_id = ?
    `).get(memberId, organizationId);

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Deactivate user instead of deleting
    db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(memberId);

    await logAuditAction(userId, 'REMOVE_USER', 'user', memberId, {
      email: member.email
    });

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Member removal error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Get organization usage metrics
router.get('/usage', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { period = '30d' } = req.query;

    let dateFilter = '';
    switch (period) {
      case '24h':
        dateFilter = "datetime(recorded_at) >= datetime('now', '-1 day')";
        break;
      case '7d':
        dateFilter = "datetime(recorded_at) >= datetime('now', '-7 days')";
        break;
      case '30d':
        dateFilter = "datetime(recorded_at) >= datetime('now', '-30 days')";
        break;
      default:
        dateFilter = "datetime(recorded_at) >= datetime('now', '-30 days')";
    }

    const usage = db.prepare(`
      SELECT 
        metric_type,
        SUM(value) as total_value,
        unit,
        COUNT(*) as data_points
      FROM usage_metrics 
      WHERE organization_id = ? AND ${dateFilter}
      GROUP BY metric_type, unit
      ORDER BY total_value DESC
    `).all(organizationId);

    res.json(usage);
  } catch (error) {
    console.error('Usage metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch usage metrics' });
  }
});

export default router;