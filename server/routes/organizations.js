import express from 'express';
import crypto from 'crypto';
import { Op, fn, col } from 'sequelize';
import { Organization, User, OrganizationInvite, Team, OpsModule, UsageMetric, Project } from '../models/index.js';
import { requireRole } from '../middleware/auth.js';
import { logAuditAction } from '../utils/audit.js';
import { createEmailTransport } from '../utils/email.js';

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
    text: `You've been invited to join ${organizationName} on Aikya.

Accept the invite: ${inviteLink}

This link expires in ${INVITE_EXPIRES_DAYS} days.`,
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

    const organization = await Organization.findByPk(organizationId, { raw: true });
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const [memberCount, projectCount, pendingInvites] = await Promise.all([
      User.count({ where: { organization_id: organizationId, is_active: true } }),
      Project.count({ where: { organization_id: organizationId } }),
      OrganizationInvite.count({
        where: {
          organization_id: organizationId,
          status: 'pending',
          [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: new Date() } }]
        }
      })
    ]);

    res.json({
      ...organization,
      member_count: memberCount,
      project_count: projectCount,
      pending_invites: pendingInvites,
      settings: organization.settings || {}
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

    await Organization.update(
      { name, billing_email, settings },
      { where: { id: organizationId } }
    );

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

    const members = await User.findAll({
      where: { organization_id: organizationId },
      // Only expose safe fields — never password_hash, two_factor_secret,
      // github_token, reset_otp, otp_expiry, etc.
      attributes: ['id', 'email', 'name', 'role', 'is_active', 'permissions', 'last_login', 'created_at'],
      order: [['role', 'ASC'], ['name', 'ASC']],
      raw: true
    });

    const response = members.map((member) => ({
      ...member,
      permissions: member.permissions || {}
    }));

    res.json(response);
  } catch (error) {
    console.error('Members fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Update member permissions
router.put('/members/:memberId/permissions', requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const userId = req.user.id;
    const { memberId } = req.params;
    const { ops_access } = req.body || {};

    const member = await User.findOne({ where: { id: memberId, organization_id: organizationId }, raw: true });
    if (!member) {
      return res.status(404).json({ error: 'Member not found.' });
    }

    if (Number(memberId) === Number(userId)) {
      return res.status(400).json({ error: 'You cannot change your own permissions.' });
    }

    if (ops_access !== null && !Array.isArray(ops_access)) {
      return res.status(400).json({ error: 'ops_access must be an array or null.' });
    }

    let normalizedOps = null;
    if (Array.isArray(ops_access)) {
      normalizedOps = ops_access.map((item) => String(item)).filter(Boolean);
      const rows = await OpsModule.findAll({ attributes: ['key'], raw: true });
      const allowedKeys = rows.map((row) => row.key);
      const invalid = normalizedOps.filter((key) => !allowedKeys.includes(key));
      if (invalid.length > 0) {
        return res.status(400).json({ error: `Invalid ops module keys: ${invalid.join(', ')}` });
      }
    }

    const existingPermissions = member.permissions || {};
    if (normalizedOps === null) {
      delete existingPermissions.ops_access;
    } else {
      existingPermissions.ops_access = normalizedOps;
    }

    await User.update(
      { permissions: existingPermissions },
      { where: { id: memberId } }
    );

    await logAuditAction(userId, 'UPDATE_MEMBER_PERMISSIONS', 'user', memberId, {
      ops_access: normalizedOps
    });

    res.json({
      message: 'Permissions updated.',
      permissions: existingPermissions
    });
  } catch (error) {
    console.error('Member permissions update error:', error);
    res.status(500).json({ error: 'Failed to update permissions' });
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

    await Organization.update(
      { seat_limit: Number(seat_limit) },
      { where: { id: organizationId } }
    );

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

    const organization = await Organization.findByPk(organizationId, { raw: true });
    const [memberCount, pendingInvites] = await Promise.all([
      User.count({ where: { organization_id: organizationId, is_active: true } }),
      OrganizationInvite.count({
        where: {
          organization_id: organizationId,
          status: 'pending',
          [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: new Date() } }]
        }
      })
    ]);

    if (organization?.seat_limit && memberCount + pendingInvites >= organization.seat_limit) {
      return res.status(400).json({ error: 'Seat limit reached. Please increase your seat limit to invite more users.' });
    }

    const existingUser = await User.findOne({ where: { email }, raw: true });
    if (existingUser) {
      if (Number(existingUser.organization_id) !== Number(organizationId)) {
        return res.status(400).json({ error: 'User belongs to another organization.' });
      }
      if (existingUser.is_active) {
        return res.status(400).json({ error: 'User is already a member of this organization.' });
      }
    }

    const normalizedTeamIds = Array.isArray(team_ids)
      ? team_ids.map((id) => Number(id)).filter(Boolean)
      : [];

    if (normalizedTeamIds.length > 0) {
      const validTeams = await Team.count({
        where: {
          organization_id: organizationId,
          id: { [Op.in]: normalizedTeamIds }
        }
      });
      if (validTeams !== normalizedTeamIds.length) {
        return res.status(400).json({ error: 'One or more selected teams are invalid.' });
      }
    }

    const inviteToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    const existingInvite = await OrganizationInvite.findOne({
      where: { organization_id: organizationId, email }
    });

    if (existingInvite) {
      await OrganizationInvite.update(
        {
          role,
          team_ids: normalizedTeamIds,
          token: inviteToken,
          status: 'pending',
          invited_by: userId,
          expires_at: expiresAt,
          accepted_at: null
        },
        { where: { id: existingInvite.id } }
      );
    } else {
      await OrganizationInvite.create({
        organization_id: organizationId,
        email,
        role,
        team_ids: normalizedTeamIds,
        token: inviteToken,
        status: 'pending',
        invited_by: userId,
        expires_at: expiresAt
      });
    }

    const organizationName = organization?.name || 'your organization';
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

    const member = await User.findOne({ where: { id: memberId, organization_id: organizationId }, raw: true });
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (Number(memberId) === Number(userId)) {
      return res.status(400).json({ error: 'You cannot change your own role.' });
    }

    await User.update({ role }, { where: { id: memberId } });

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

    const member = await User.findOne({ where: { id: memberId, organization_id: organizationId }, raw: true });
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (Number(memberId) === Number(userId)) {
      return res.status(400).json({ error: 'You cannot remove yourself.' });
    }

    await User.update({ is_active: false }, { where: { id: memberId } });

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

    let startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (period === '24h') {
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    } else if (period === '7d') {
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }

    const usage = await UsageMetric.findAll({
      where: {
        organization_id: organizationId,
        recorded_at: { [Op.gte]: startDate }
      },
      attributes: [
        'metric_type',
        'unit',
        [fn('SUM', col('value')), 'total_value'],
        [fn('COUNT', col('id')), 'data_points']
      ],
      group: ['metric_type', 'unit'],
      order: [[fn('SUM', col('value')), 'DESC']],
      raw: true
    });

    res.json(usage);
  } catch (error) {
    console.error('Usage metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch usage metrics' });
  }
});

export default router;
