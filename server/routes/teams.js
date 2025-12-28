import express from 'express';
import { db } from '../database/init.js';
import { requireRole } from '../middleware/auth.js';
import { logAuditAction } from '../utils/audit.js';

const router = express.Router();

// Get teams with members (org scoped)
router.get('/', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;

    const teams = db.prepare(`
      SELECT id, name, description, created_at
      FROM teams
      WHERE organization_id = ?
      ORDER BY name
    `).all(organizationId);

    const members = db.prepare(`
      SELECT tm.team_id, u.id, u.name, u.email, u.role
      FROM team_members tm
      JOIN users u ON u.id = tm.user_id
      JOIN teams t ON t.id = tm.team_id
      WHERE t.organization_id = ? AND u.is_active = 1
      ORDER BY u.name
    `).all(organizationId);

    const membersByTeam = members.reduce((acc, member) => {
      if (!acc[member.team_id]) {
        acc[member.team_id] = [];
      }
      acc[member.team_id].push({
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role
      });
      return acc;
    }, {});

    const response = teams.map((team) => ({
      ...team,
      members: membersByTeam[team.id] || []
    }));

    res.json(response);
  } catch (error) {
    console.error('Teams fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Create a new team
router.post('/', requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const userId = req.user.id;
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Team name is required.' });
    }

    const result = db.prepare(`
      INSERT INTO teams (organization_id, name, description, created_by)
      VALUES (?, ?, ?, ?)
    `).run(organizationId, name.trim(), description?.trim() || null, userId);

    await logAuditAction(userId, 'CREATE_TEAM', 'team', result.lastInsertRowid, {
      name: name.trim()
    });

    res.json({ id: result.lastInsertRowid, message: 'Team created successfully' });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'A team with this name already exists.' });
    }
    console.error('Team creation error:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// Delete a team
router.delete('/:teamId', requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { teamId } = req.params;
    const organizationId = req.user.organization_id;
    const userId = req.user.id;

    const team = db.prepare(`
      SELECT id, name FROM teams WHERE id = ? AND organization_id = ?
    `).get(teamId, organizationId);

    if (!team) {
      return res.status(404).json({ error: 'Team not found.' });
    }

    db.prepare('DELETE FROM teams WHERE id = ?').run(teamId);

    await logAuditAction(userId, 'DELETE_TEAM', 'team', teamId, { name: team.name });

    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Team deletion error:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// Add existing member to team
router.post('/:teamId/members', requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { teamId } = req.params;
    const { userId } = req.body;
    const organizationId = req.user.organization_id;

    if (!userId) {
      return res.status(400).json({ error: 'User is required.' });
    }

    const team = db.prepare('SELECT id FROM teams WHERE id = ? AND organization_id = ?').get(teamId, organizationId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found.' });
    }

    const member = db.prepare('SELECT id FROM users WHERE id = ? AND organization_id = ? AND is_active = 1').get(userId, organizationId);
    if (!member) {
      return res.status(404).json({ error: 'User not found.' });
    }

    db.prepare(`
      INSERT OR IGNORE INTO team_members (team_id, user_id, role)
      VALUES (?, ?, 'member')
    `).run(teamId, userId);

    res.json({ message: 'Member added to team.' });
  } catch (error) {
    console.error('Add team member error:', error);
    res.status(500).json({ error: 'Failed to add team member' });
  }
});

// Remove member from team
router.delete('/:teamId/members/:memberId', requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { teamId, memberId } = req.params;
    const organizationId = req.user.organization_id;

    const team = db.prepare('SELECT id FROM teams WHERE id = ? AND organization_id = ?').get(teamId, organizationId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found.' });
    }

    db.prepare(`
      DELETE FROM team_members
      WHERE team_id = ? AND user_id = ?
    `).run(teamId, memberId);

    res.json({ message: 'Member removed from team.' });
  } catch (error) {
    console.error('Remove team member error:', error);
    res.status(500).json({ error: 'Failed to remove team member' });
  }
});

export default router;
