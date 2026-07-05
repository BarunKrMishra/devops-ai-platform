import express from 'express';
import { Op } from 'sequelize';
import { Notification } from '../models/index.js';
import { io } from '../index.js';

const router = express.Router();

// Get user notifications
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const organizationId = req.user.organization_id;
    const { unread_only, limit = 50 } = req.query;

    const filters = {
      [Op.and]: [
        { [Op.or]: [{ user_id: userId }, { organization_id: organizationId }] },
        { [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: new Date() } }] }
      ]
    };

    if (unread_only === 'true') {
      filters[Op.and].push({ read: false });
    }

    const notifications = await Notification.findAll({
      where: filters,
      order: [['priority', 'DESC'], ['created_at', 'DESC']],
      limit: Number(limit) || 50,
      raw: true
    });

    res.json(
      notifications.map((notification) => ({
        ...notification,
        data: notification.data || {}
      }))
    );
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

    const result = await Notification.update(
      { read: true },
      { where: { id, user_id: userId } }
    );

    if (result[0] === 0) {
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

    await Notification.update(
      { read: true },
      { where: { [Op.or]: [{ user_id: userId }, { organization_id: organizationId }], read: false } }
    );

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

    const notificationDoc = await Notification.create({
      user_id: user_id || undefined,
      organization_id: organization_id || undefined,
      type,
      title,
      message,
      data: notificationData,
      priority,
      expires_at: expires_at || null,
      read: false
    });

    const notification = {
      ...notificationDoc.get({ plain: true }),
      data: notificationData,
      read: false
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

    const result = await Notification.destroy({ where: { id, user_id: userId } });

    if (result === 0) {
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

    const baseFilters = {
      [Op.and]: [
        { [Op.or]: [{ user_id: userId }, { organization_id: organizationId }] },
        { [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: new Date() } }] }
      ]
    };

    const [total, unread, highPriorityUnread] = await Promise.all([
      Notification.count({ where: baseFilters }),
      Notification.count({ where: { ...baseFilters, read: false } }),
      Notification.count({ where: { ...baseFilters, read: false, priority: 'high' } })
    ]);

    res.json({
      total,
      unread,
      high_priority_unread: highPriorityUnread
    });
  } catch (error) {
    console.error('Notification stats error:', error);
    res.status(500).json({ error: 'Failed to fetch notification stats' });
  }
});

export default router;
