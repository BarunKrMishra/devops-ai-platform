import express from 'express';
import { db } from '../database/init.js';
import { requireRole } from '../middleware/auth.js';
import { logAuditAction } from '../utils/audit.js';
import { createEmailTransport } from '../utils/email.js';
import crypto from 'crypto';

const router = express.Router();
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5173';
const INVITE_EXPIRES_DAYS = 7;
const ALLOWED_INVITE_ROLES = ['developer', 'manager', 'admin', 'viewer'];
const emailFrom = process.env.EMAIL_FROM || process.env.EMAIL_USER;

let transporter = createEmailTransport();

if (transporter) {
  transporter.verify((error) => {
    if (error) {
      console.error('Team invite email transporter verification failed:', error);
    }
  });
} else {
  console.warn('Email credentials not configured for team invites.');
}

const sendInviteEmail = async ({ to, organizationName, inviteLink }) => {
  if (!transporter) {
    console.log('Invite email not sent - transporter not configured.', { to, inviteLink });
    return { success: false };
  }

  const message = {
    from: emailFrom,
    to,
    subject: `You're invited to join ${organizationName} on Aikya`,
    text: `You've been invited to join ${organizationName} on Aikya.\n\nAccept the invite: ${inviteLink}\n\nThis link expires in ${INVITE_EXPIRES_DAYS} days.`,
    html: `
      <p>You've been invited to join <strong>${organizationName}</strong> on Aikya.</p>
      <p><a href="${inviteLink}">Accept the invite</a></p>
      <p>This link expires in ${INVITE_EXPIRES_DAYS} days.</p>
    `
  };

  const maxAttempts = 3;
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      return await transporter.sendMail(message);
    } catch (error) {
      attempt += 1;
      if (attempt >= maxAttempts) {
        throw error;
      }
      const delay = 500 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

// Get organization details
router.get('/', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;

    const organization = db.prepare(`
      SELECT o.*,
        (SELECT COUNT(*) FROM users u WHERE u.organization_id = o.id AND u.is_active = 1) as member_count,
        (SELECT COUNT(*) FROM projects p WHERE p.organization_id = o.id) as project_count,
        (SELECT COUNT(*) FROM organization_invites i WHERE i.organization_id = o.id AND i.status = 'pending' AND (i.expires_at IS NULL OR datetime(i.expires_at) > datetime('now'))) as pending_invites
      FROM organizations o
      WHERE o.id = ?
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

// Update seat limit
router.put('/seat-limit', requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const userId = req.user.id;
    const { seat_limit } = req.body;

    if (!seat_limit || Number.isNaN(Number(seat_limit)) || Number(seat_limit) < 1) {
      return res.status(400).json({ error: 'Seat limit must be a positive number.' });
    }

    db.prepare(`
      UPDATE organizations 
      SET seat_limit = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(Number(seat_limit), organizationId);

    await logAuditAction(userId, 'UPDATE_SEAT_LIMIT', 'organization', organizationId, {
      seat_limit: Number(seat_limit)
    });

    res.json({ message: 'Seat limit updated successfully' });
  } catch (error) {
    console.error('Seat limit update error:', error);
    res.status(500).json({ error: 'Failed to update seat limit' });
  }
});

// Invite user to organization
router.post('/invites', requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const userId = req.user.id;
    const { email, role = 'developer', team_ids = [] } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (!ALLOWED_INVITE_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const organization = db.prepare('SELECT seat_limit FROM organizations WHERE id = ?').get(organizationId);
    const memberCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE organization_id = ? AND is_active = 1').get(organizationId).count;
    const pendingInvites = db.prepare(`
      SELECT COUNT(*) as count 
      FROM organization_invites 
      WHERE organization_id = ? AND status = 'pending' AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))
    `).get(organizationId).count;

    if (organization?.seat_limit && memberCount + pendingInvites >= organization.seat_limit) {
      return res.status(400).json({ error: 'Seat limit reached. Please increase your seat limit to invite more users.' });
    }

    const existingUser = db.prepare('SELECT id, organization_id, is_active FROM users WHERE email = ?').get(email);
    if (existingUser) {
      if (existingUser.organization_id !== organizationId) {
        return res.status(400).json({ error: 'User belongs to another organization.' });
      }
      if (existingUser.is_active) {
        return res.status(400).json({ error: 'User is already a member of this organization.' });
      }
    }

    const normalizedTeamIds = Array.isArray(team_ids) ? team_ids.map(Number).filter(Boolean) : [];
    if (normalizedTeamIds.length > 0) {
      const rows = db.prepare(`
        SELECT id FROM teams WHERE organization_id = ? AND id IN (${normalizedTeamIds.map(() => '?').join(',')})
      `).all(organizationId, ...normalizedTeamIds);
      if (rows.length !== normalizedTeamIds.length) {
        return res.status(400).json({ error: 'One or more selected teams are invalid.' });
      }
    }

    const inviteToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_EXPIRES_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const existingInvite = db.prepare('SELECT id FROM organization_invites WHERE organization_id = ? AND email = ?').get(organizationId, email);
    if (existingInvite) {
      db.prepare(`
        UPDATE organization_invites
        SET role = ?, team_ids = ?, token = ?, status = 'pending', invited_by = ?, expires_at = ?, accepted_at = NULL, created_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(role, JSON.stringify(normalizedTeamIds), inviteToken, userId, expiresAt, existingInvite.id);
    } else {
      db.prepare(`
        INSERT INTO organization_invites (organization_id, email, role, team_ids, token, status, invited_by, expires_at)
        VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
      `).run(organizationId, email, role, JSON.stringify(normalizedTeamIds), inviteToken, userId, expiresAt);
    }

    const organizationName = db.prepare('SELECT name FROM organizations WHERE id = ?').get(organizationId)?.name || 'your organization';
    const inviteLink = `${APP_BASE_URL}/accept-invite?token=${inviteToken}`;

    let emailSent = true;
    try {
      await sendInviteEmail({ to: email, organizationName, inviteLink });
    } catch (emailError) {
      emailSent = false;
      console.error('Invite email failed:', emailError);
    }

    await logAuditAction(userId, 'INVITE_USER', 'user', organizationId, {
      email,
      role,
      team_ids: normalizedTeamIds,
      email_sent: emailSent
    });

    res.json({
      message: emailSent ? 'Invite sent successfully.' : 'Invite created. Email delivery failed.',
      email_sent: emailSent,
      invite_link: emailSent ? undefined : inviteLink
    });
  } catch (error) {
    console.error('User invitation error:', error);
    res.status(500).json({ error: 'Failed to invite user' });
  }
});

const ALLOWED_MEMBER_ROLES = ['developer', 'manager', 'admin', 'viewer', 'user'];

// Update member role
router.put('/members/:memberId/role', requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { memberId } = req.params;
    const { role } = req.body;
    const organizationId = req.user.organization_id;
    const userId = req.user.id;

    if (!ALLOWED_MEMBER_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Verify member belongs to organization
    const member = db.prepare(`
      SELECT id, email FROM users 
      WHERE id = ? AND organization_id = ?
    `).get(memberId, organizationId);

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (Number(memberId) === Number(userId)) {
      return res.status(400).json({ error: 'You cannot change your own role.' });
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
router.delete('/members/:memberId', requireRole(['admin', 'manager']), async (req, res) => {
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

    if (Number(memberId) === Number(userId)) {
      return res.status(400).json({ error: 'You cannot remove yourself.' });
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
