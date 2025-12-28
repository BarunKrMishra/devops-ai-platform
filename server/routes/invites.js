import express from 'express';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import { db } from '../database/init.js';

const router = express.Router();

const isInviteExpired = (invite) => {
  if (!invite.expires_at) return false;
  return new Date(invite.expires_at) < new Date();
};

router.get('/:token', (req, res) => {
  try {
    const { token } = req.params;
    const invite = db.prepare(`
      SELECT i.*, o.name as organization_name
      FROM organization_invites i
      JOIN organizations o ON o.id = i.organization_id
      WHERE i.token = ?
    `).get(token);

    if (!invite || invite.status !== 'pending' || isInviteExpired(invite)) {
      return res.status(404).json({ error: 'Invite not found or expired' });
    }

    res.json({
      email: invite.email,
      role: invite.role,
      organization_name: invite.organization_name
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

    const invite = db.prepare(`
      SELECT i.*, o.name as organization_name
      FROM organization_invites i
      JOIN organizations o ON o.id = i.organization_id
      WHERE i.token = ?
    `).get(token);

    if (!invite || invite.status !== 'pending' || isInviteExpired(invite)) {
      return res.status(404).json({ error: 'Invite not found or expired' });
    }

    const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(invite.email);
    if (existingUser && existingUser.is_active && existingUser.organization_id !== invite.organization_id) {
      return res.status(400).json({ error: 'User already belongs to another organization.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const secret = existingUser?.two_factor_secret
      ? existingUser.two_factor_secret
      : speakeasy.generateSecret({ name: `Aikya (${invite.email})` }).base32;

    let userId = existingUser?.id;
    if (existingUser) {
      db.prepare(`
        UPDATE users
        SET password_hash = ?, role = ?, organization_id = ?, is_active = 1, name = ?, two_factor_secret = ?
        WHERE id = ?
      `).run(
        passwordHash,
        invite.role,
        invite.organization_id,
        name || existingUser.name,
        secret,
        existingUser.id
      );
    } else {
      const result = db.prepare(`
        INSERT INTO users (email, password_hash, role, organization_id, is_active, two_factor_secret, name)
        VALUES (?, ?, ?, ?, 1, ?, ?)
      `).run(invite.email, passwordHash, invite.role, invite.organization_id, secret, name || null);
      userId = result.lastInsertRowid;
    }

    const teamIds = JSON.parse(invite.team_ids || '[]');
    if (Array.isArray(teamIds) && teamIds.length > 0) {
      const teams = db.prepare(`
        SELECT id FROM teams WHERE organization_id = ? AND id IN (${teamIds.map(() => '?').join(',')})
      `).all(invite.organization_id, ...teamIds);
      teams.forEach((team) => {
        db.prepare(`
          INSERT OR IGNORE INTO team_members (team_id, user_id, role)
          VALUES (?, ?, 'member')
        `).run(team.id, userId);
      });
    }

    db.prepare(`
      UPDATE organization_invites
      SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(invite.id);

    res.json({ message: 'Invite accepted. You can now sign in.' });
  } catch (error) {
    console.error('Invite accept error:', error);
    res.status(500).json({ error: 'Failed to accept invite' });
  }
});

export default router;
