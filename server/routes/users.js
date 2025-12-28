import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../database/init.js';
import { logAuditAction } from '../utils/audit.js';

const router = express.Router();

const defaultNotifications = {
  deployments: true,
  alerts: true,
  costOptimization: false,
  weeklyReports: true
};

const getUserSettings = (userId) => {
  const settings = db.prepare('SELECT notifications, experience FROM user_settings WHERE user_id = ?').get(userId);
  if (!settings) {
    return {
      notifications: defaultNotifications,
      experience: {}
    };
  }

  return {
    notifications: settings.notifications ? JSON.parse(settings.notifications) : defaultNotifications,
    experience: settings.experience ? JSON.parse(settings.experience) : {}
  };
};

const upsertUserSettings = (userId, { notifications, experience }) => {
  const existing = db.prepare('SELECT user_id, notifications, experience FROM user_settings WHERE user_id = ?').get(userId);
  const nextNotifications = notifications ?? (existing?.notifications ? JSON.parse(existing.notifications) : defaultNotifications);
  const nextExperience = experience ?? (existing?.experience ? JSON.parse(existing.experience) : {});

  if (existing) {
    db.prepare(`
      UPDATE user_settings
      SET notifications = ?, experience = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(JSON.stringify(nextNotifications), JSON.stringify(nextExperience), userId);
  } else {
    db.prepare(`
      INSERT INTO user_settings (user_id, notifications, experience)
      VALUES (?, ?, ?)
    `).run(userId, JSON.stringify(nextNotifications), JSON.stringify(nextExperience));
  }

  return { notifications: nextNotifications, experience: nextExperience };
};

router.get('/me', (req, res) => {
  try {
    const userId = req.user.id;
    const user = db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const settings = getUserSettings(userId);

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

    const current = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(userId);
    if (!current) {
      return res.status(404).json({ error: 'User not found.' });
    }

    let nextEmail = current.email;
    if (email && email !== current.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format.' });
      }
      const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, userId);
      if (existing) {
        return res.status(400).json({ error: 'Email already in use.' });
      }
      nextEmail = email;
    }

    const nextName = name ?? current.name;

    db.prepare('UPDATE users SET name = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(nextName, nextEmail, userId);

    await logAuditAction(userId, 'UPDATE_PROFILE', 'user', userId, {
      name: nextName,
      email: nextEmail
    });

    res.json({
      user: {
        id: current.id,
        name: nextName,
        email: nextEmail,
        role: req.user.role
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

router.patch('/me/notifications', (req, res) => {
  try {
    const userId = req.user.id;
    const payload = req.body.notifications || req.body;
    const normalized = {
      ...defaultNotifications,
      ...payload
    };

    const updated = upsertUserSettings(userId, { notifications: normalized });

    res.json({
      notifications: updated.notifications
    });
  } catch (error) {
    console.error('Notifications update error:', error);
    res.status(500).json({ error: 'Failed to update notifications.' });
  }
});

router.patch('/me/experience', (req, res) => {
  try {
    const userId = req.user.id;
    const payload = req.body.experience || req.body;
    const updated = upsertUserSettings(userId, { experience: payload || {} });

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

    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const validPassword = await bcrypt.compare(current_password, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const passwordHash = await bcrypt.hash(new_password, 12);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(passwordHash, userId);

    await logAuditAction(userId, 'CHANGE_PASSWORD', 'user', userId);

    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

router.get('/me/api-keys', (req, res) => {
  try {
    const userId = req.user.id;
    const keys = db.prepare(`
      SELECT id, name, last_four, created_at, last_used, is_active
      FROM user_api_keys
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(userId);

    res.json(keys);
  } catch (error) {
    console.error('API key fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch API keys.' });
  }
});

router.post('/me/api-keys', (req, res) => {
  try {
    const userId = req.user.id;
    const { name } = req.body;
    const rawKey = crypto.randomBytes(24).toString('hex');
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const lastFour = rawKey.slice(-4);

    const result = db.prepare(`
      INSERT INTO user_api_keys (user_id, name, key_hash, last_four)
      VALUES (?, ?, ?, ?)
    `).run(userId, name || 'Personal key', keyHash, lastFour);

    res.json({
      id: result.lastInsertRowid,
      key: rawKey,
      last_four: lastFour
    });
  } catch (error) {
    console.error('API key create error:', error);
    res.status(500).json({ error: 'Failed to create API key.' });
  }
});

router.delete('/me/api-keys/:id', (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    db.prepare(`
      UPDATE user_api_keys
      SET is_active = 0
      WHERE id = ? AND user_id = ?
    `).run(id, userId);

    res.json({ message: 'API key revoked.' });
  } catch (error) {
    console.error('API key revoke error:', error);
    res.status(500).json({ error: 'Failed to revoke API key.' });
  }
});

export default router;
