import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User, UserSetting, UserApiKey } from '../models/index.js';
import { logAuditAction } from '../utils/audit.js';

const router = express.Router();

const defaultNotifications = {
  deployments: true,
  alerts: true,
  costOptimization: false,
  weeklyReports: true
};

const getUserSettings = async (userId) => {
  const settings = await UserSetting.findOne({ where: { user_id: userId }, raw: true });
  if (!settings) {
    return {
      notifications: defaultNotifications,
      experience: {}
    };
  }

  return {
    notifications: settings.notifications || defaultNotifications,
    experience: settings.experience || {}
  };
};

const upsertUserSettings = async (userId, { notifications, experience }) => {
  const existing = await UserSetting.findOne({ where: { user_id: userId } });
  const nextNotifications = notifications ?? (existing?.notifications || defaultNotifications);
  const nextExperience = experience ?? (existing?.experience || {});

  if (existing) {
    await UserSetting.update(
      { notifications: nextNotifications, experience: nextExperience },
      { where: { user_id: userId } }
    );
  } else {
    await UserSetting.create({
      user_id: userId,
      notifications: nextNotifications,
      experience: nextExperience
    });
  }

  return { notifications: nextNotifications, experience: nextExperience };
};

router.get('/me', async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId, { attributes: ['id', 'email', 'name', 'role'], raw: true });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const settings = await getUserSettings(userId);

    res.json({
      user,
      settings
    });
  } catch (error) {
    console.error('User settings fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch user settings.' });
  }
});

router.patch('/me', async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email } = req.body;

    const current = await User.findByPk(userId, { attributes: ['id', 'email', 'name', 'role'], raw: true });
    if (!current) {
      return res.status(404).json({ error: 'User not found.' });
    }

    let nextEmail = current.email;
    if (email && email !== current.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format.' });
      }
      const existing = await User.findOne({ where: { email }, raw: true });
      if (existing && existing.id !== userId) {
        return res.status(400).json({ error: 'Email already in use.' });
      }
      nextEmail = email;
    }

    const nextName = name ?? current.name;

    await User.update(
      { name: nextName, email: nextEmail },
      { where: { id: userId } }
    );

    await logAuditAction(userId, 'UPDATE_PROFILE', 'user', userId, {
      name: nextName,
      email: nextEmail
    });

    res.json({
      user: {
        id: current.id,
        name: nextName,
        email: nextEmail,
        role: current.role
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

router.patch('/me/notifications', async (req, res) => {
  try {
    const userId = req.user.id;
    const payload = req.body.notifications || req.body;
    const normalized = {
      ...defaultNotifications,
      ...payload
    };

    const updated = await upsertUserSettings(userId, { notifications: normalized });

    res.json({
      notifications: updated.notifications
    });
  } catch (error) {
    console.error('Notifications update error:', error);
    res.status(500).json({ error: 'Failed to update notifications.' });
  }
});

router.patch('/me/experience', async (req, res) => {
  try {
    const userId = req.user.id;
    const payload = req.body.experience || req.body;
    const updated = await upsertUserSettings(userId, { experience: payload || {} });

    res.json({
      experience: updated.experience
    });
  } catch (error) {
    console.error('Experience update error:', error);
    res.status(500).json({ error: 'Failed to update experience settings.' });
  }
});

router.post('/me/change-password', async (req, res) => {
  try {
    const userId = req.user.id;
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current and new passwords are required.' });
    }

    if (new_password.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
    }

    const user = await User.findByPk(userId, { attributes: ['password_hash'], raw: true });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const validPassword = await bcrypt.compare(current_password, user.password_hash || '');
    if (!validPassword) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const passwordHash = await bcrypt.hash(new_password, 12);
    await User.update(
      { password_hash: passwordHash },
      { where: { id: userId } }
    );

    await logAuditAction(userId, 'CHANGE_PASSWORD', 'user', userId);

    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

router.get('/me/api-keys', async (req, res) => {
  try {
    const userId = req.user.id;
    const keys = await UserApiKey.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
      raw: true
    });

    res.json(keys);
  } catch (error) {
    console.error('API key fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch API keys.' });
  }
});

router.post('/me/api-keys', async (req, res) => {
  try {
    const userId = req.user.id;
    const { name } = req.body;
    const rawKey = crypto.randomBytes(24).toString('hex');
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const lastFour = rawKey.slice(-4);

    const result = await UserApiKey.create({
      user_id: userId,
      name: name || 'Personal key',
      key_hash: keyHash,
      last_four: lastFour
    });

    res.json({
      id: result.id,
      key: rawKey,
      last_four: lastFour
    });
  } catch (error) {
    console.error('API key create error:', error);
    res.status(500).json({ error: 'Failed to create API key.' });
  }
});

router.delete('/me/api-keys/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    await UserApiKey.update({ is_active: false }, { where: { id, user_id: userId } });

    res.json({ message: 'API key revoked.' });
  } catch (error) {
    console.error('API key revoke error:', error);
    res.status(500).json({ error: 'Failed to revoke API key.' });
  }
});

export default router;
