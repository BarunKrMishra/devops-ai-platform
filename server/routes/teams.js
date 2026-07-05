import express from 'express';
import { Op } from 'sequelize';
import { Team, TeamMember, User } from '../models/index.js';
import { requireRole } from '../middleware/auth.js';
import { logAuditAction } from '../utils/audit.js';

const router = express.Router();

// Get teams with members (org scoped)
router.get('/', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;

    const teams = await Team.findAll({
      where: { organization_id: organizationId },
      order: [['name', 'ASC']],
      raw: true
    });

    const teamMembers = await TeamMember.findAll({
      where: { organization_id: organizationId },
      raw: true
    });

    const userIds = Array.from(new Set(teamMembers.map((member) => member.user_id).filter(Boolean)));
    const users = userIds.length
      ? await User.findAll({
          where: { id: { [Op.in]: userIds }, is_active: true },
          attributes: ['id', 'name', 'email', 'role', 'is_active'],
          raw: true
        })
      : [];

    const usersById = users.reduce((acc, user) => {
      acc[user.id] = user;
      return acc;
    }, {});

    const membersByTeam = teamMembers.reduce((acc, member) => {
      const teamId = String(member.team_id);
      if (!acc[teamId]) {
        acc[teamId] = [];
      }
      const user = usersById[member.user_id];
      if (user && user.is_active !== false) {
        acc[teamId].push({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        });
      }
      return acc;
    }, {});

    const response = teams.map((team) => ({
      ...team,
      members: membersByTeam[String(team.id)] || []
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

    const team = await Team.create({
      organization_id: organizationId,
      name: name.trim(),
      description: description?.trim() || null,
      created_by: userId
    });

    await logAuditAction(userId, 'CREATE_TEAM', 'team', team.id, {
      name: team.name
    });

    res.json({ id: team.id, message: 'Team created successfully' });
  } catch (error) {
    if (error?.name === 'SequelizeUniqueConstraintError') {
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

    const team = await Team.findOne({ where: { id: teamId, organization_id: organizationId }, raw: true });
    if (!team) {
      return res.status(404).json({ error: 'Team not found.' });
    }

    await Team.destroy({ where: { id: teamId, organization_id: organizationId } });
    await TeamMember.destroy({ where: { team_id: teamId, organization_id: organizationId } });

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

    const team = await Team.findOne({ where: { id: teamId, organization_id: organizationId }, raw: true });
    if (!team) {
      return res.status(404).json({ error: 'Team not found.' });
    }

    const member = await User.findOne({
      where: { id: userId, organization_id: organizationId, is_active: true },
      raw: true
    });
    if (!member) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await TeamMember.findOrCreate({
      where: { team_id: teamId, user_id: userId },
      defaults: { organization_id: organizationId, role: 'member' }
    });

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

    const team = await Team.findOne({ where: { id: teamId, organization_id: organizationId }, raw: true });
    if (!team) {
      return res.status(404).json({ error: 'Team not found.' });
    }

    await TeamMember.destroy({ where: { team_id: teamId, user_id: memberId, organization_id: organizationId } });

    res.json({ message: 'Member removed from team.' });
  } catch (error) {
    console.error('Remove team member error:', error);
    res.status(500).json({ error: 'Failed to remove team member' });
  }
});

export default router;
