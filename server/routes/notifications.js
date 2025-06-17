import express from 'express';
import { db } from '../database/init.js';
import { io } from '../index.js';

const router = express.Router();

// Get user notifications
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const organizationId = req.user.organization_id;
    const { unread_only, limit = 50 } = req.query;

    let query = `
      SELECT * FROM notifications 
      WHERE (user_id = ? OR organization_id = ?) 
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `;
    const params = [userId, organizationId];

    if (unread_only === 'true') {
      query += ` AND read = 0`;
    }

    query += ` ORDER BY priority DESC, created_at DESC LIMIT ?`;
    params.push(parseInt(limit));

    const notifications = db.prepare(query).all(...params);

    res.json(notifications.map(notification => ({
      ...notification,
      data: JSON.parse(notification.data)
    })));
  } catch (error) {
    console.error('Notifications fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = db.prepare(`
      UPDATE notifications 
      SET read = 1 
      WHERE id = ? AND user_id = ?
    `).run(id, userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Notification update error:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// Mark all notifications as read
router.put('/read-all', async (req, res) => {
  try {
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    db.prepare(`
      UPDATE notifications 
      SET read = 1 
      WHERE (user_id = ? OR organization_id = ?) AND read = 0
    `).run(userId, organizationId);

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Notifications update error:', error);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// Create notification (internal use)
export const createNotification = async (data) => {
  try {
    const {
      user_id,
      organization_id,
      type,
      title,
      message,
      priority = 'normal',
      data: notificationData = {},
      expires_at
    } = data;

    const result = db.prepare(`
      INSERT INTO notifications (user_id, organization_id, type, title, message, data, priority, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user_id,
      organization_id,
      type,
      title,
      message,
      JSON.stringify(notificationData),
      priority,
      expires_at
    );

    const notification = {
      id: result.lastInsertRowid,
      ...data,
      data: notificationData,
      read: false,
      created_at: new Date().toISOString()
    };

    // Send real-time notification
    if (user_id) {
      io.to(`user-${user_id}`).emit('notification', notification);
    }
    if (organization_id) {
      io.to(`org-${organization_id}`).emit('notification', notification);
    }

    return notification;
  } catch (error) {
    console.error('Notification creation error:', error);
    throw error;
  }
};

// Delete notification
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = db.prepare(`
      DELETE FROM notifications 
      WHERE id = ? AND user_id = ?
    `).run(id, userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Notification deletion error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Get notification statistics
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN read = 0 THEN 1 ELSE 0 END) as unread,
        SUM(CASE WHEN priority = 'high' AND read = 0 THEN 1 ELSE 0 END) as high_priority_unread
      FROM notifications 
      WHERE (user_id = ? OR organization_id = ?)
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `).get(userId, organizationId);

    res.json(stats);
  } catch (error) {
    console.error('Notification stats error:', error);
    res.status(500).json({ error: 'Failed to fetch notification stats' });
  }
});

export default router;