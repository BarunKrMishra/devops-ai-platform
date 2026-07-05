import express from 'express';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import { Op } from 'sequelize';
import { OrganizationInvite, Organization, User, Team, TeamMember } from '../models/index.js';

const router = express.Router();

const isInviteExpired = (invite) => {
  if (!invite.expires_at) return false;
  return new Date(invite.expires_at) < new Date();
};

router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const invite = await OrganizationInvite.findOne({ where: { token }, raw: true });

    if (!invite || invite.status !== 'pending' || isInviteExpired(invite)) {
      return res.status(404).json({ error: 'Invite not found or expired' });
    }

    const organization = await Organization.findByPk(invite.organization_id, { raw: true });

    res.json({
      email: invite.email,
      role: invite.role,
      organization_name: organization?.name || 'Aikya workspace'
    });
  } catch (error) {
    console.error('Invite fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch invite' });
  }
});

router.post('/accept', async (req, res) => {
  try {
    const { token, name, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    const invite = await OrganizationInvite.findOne({ where: { token } });
    if (!invite || invite.status !== 'pending' || isInviteExpired(invite)) {
      return res.status(404).json({ error: 'Invite not found or expired' });
    }

    const existingUser = await User.findOne({ where: { email: invite.email } });
    if (existingUser && existingUser.is_active && Number(existingUser.organization_id) !== Number(invite.organization_id)) {
      return res.status(400).json({ error: 'User already belongs to another organization.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const secret = existingUser?.two_factor_secret
      ? existingUser.two_factor_secret
      : speakeasy.generateSecret({ name: `Aikya (${invite.email})` }).base32;

    let userId = existingUser?.id;
    if (existingUser) {
      await User.update(
        {
          password_hash: passwordHash,
          role: invite.role,
          organization_id: invite.organization_id,
          is_active: true,
          name: name || existingUser.name,
          two_factor_secret: secret
        },
        { where: { id: existingUser.id } }
      );
      userId = existingUser.id;
    } else {
      const user = await User.create({
        email: invite.email,
        password_hash: passwordHash,
        role: invite.role,
        organization_id: invite.organization_id,
        is_active: true,
        two_factor_secret: secret,
        name: name || null
      });
      userId = user.id;
    }

    const teamIds = Array.isArray(invite.team_ids) ? invite.team_ids : [];
    if (teamIds.length > 0) {
      const teams = await Team.findAll({
        where: {
          organization_id: invite.organization_id,
          id: { [Op.in]: teamIds }
        },
        attributes: ['id'],
        raw: true
      });
      for (const team of teams) {
        await TeamMember.findOrCreate({
          where: { team_id: team.id, user_id: userId },
          defaults: { organization_id: invite.organization_id, role: 'member' }
        });
      }
    }

    await OrganizationInvite.update(
      { status: 'accepted', accepted_at: new Date() },
      { where: { id: invite.id } }
    );

    res.json({ message: 'Invite accepted. You can now sign in.' });
  } catch (error) {
    console.error('Invite accept error:', error);
    res.status(500).json({ error: 'Failed to accept invite' });
  }
});

export default router;
