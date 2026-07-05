import express from 'express';
import { Op, fn, col } from 'sequelize';
import { Template, User } from '../models/index.js';
import { requireRole } from '../middleware/auth.js';
import { logAuditAction } from '../utils/audit.js';

const router = express.Router();

// Get all templates
router.get('/', async (req, res) => {
  try {
    const { category, search, public_only } = req.query;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    const filters = {
      [Op.or]: [
        { is_public: true },
        { organization_id: organizationId },
        { created_by: userId }
      ]
    };

    if (category) {
      filters.category = category;
    }

    if (search) {
      filters[Op.and] = [
        {
          [Op.or]: [
            { name: { [Op.like]: `%${search}%` } },
            { description: { [Op.like]: `%${search}%` } }
          ]
        }
      ];
    }

    if (public_only === 'true') {
      filters.is_public = true;
    }

    const templates = await Template.findAll({
      where: filters,
      order: [['downloads', 'DESC'], ['created_at', 'DESC']],
      raw: true
    });

    const userIds = Array.from(new Set(templates.map((template) => template.created_by).filter(Boolean)));
    const users = userIds.length
      ? await User.findAll({
          where: { id: { [Op.in]: userIds } },
          attributes: ['id', 'name'],
          raw: true
        })
      : [];
    const usersById = users.reduce((acc, user) => {
      acc[user.id] = user.name;
      return acc;
    }, {});

    res.json(
      templates.map((template) => ({
        ...template,
        created_by_name: usersById[template.created_by] || null,
        template_data: template.template_data || {},
        tags: template.tags || []
      }))
    );
  } catch (error) {
    console.error('Templates fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get template by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    const template = await Template.findOne({
      where: {
        id,
        [Op.or]: [
          { is_public: true },
          { organization_id: organizationId },
          { created_by: userId }
        ]
      },
      raw: true
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    await Template.increment('downloads', { where: { id } });

    const createdBy = template.created_by
      ? await User.findByPk(template.created_by, { attributes: ['name'], raw: true })
      : null;

    res.json({
      ...template,
      created_by_name: createdBy?.name || null,
      template_data: template.template_data || {},
      tags: template.tags || []
    });
  } catch (error) {
    console.error('Template fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Create new template
router.post('/', async (req, res) => {
  try {
    const { name, description, category, template_data, is_public, tags } = req.body;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    const template = await Template.create({
      name,
      description,
      category,
      template_data: template_data || {},
      is_public: Boolean(is_public),
      created_by: userId,
      organization_id: organizationId,
      tags: tags || []
    });

    await logAuditAction(userId, 'CREATE_TEMPLATE', 'template', template.id, {
      name,
      category,
      is_public
    });

    res.json({ id: template.id, message: 'Template created successfully' });
  } catch (error) {
    console.error('Template creation error:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Update template
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, template_data, is_public, tags } = req.body;
    const userId = req.user.id;

    const template = await Template.findOne({ where: { id, created_by: userId }, raw: true });
    if (!template) {
      return res.status(404).json({ error: 'Template not found or access denied' });
    }

    await Template.update(
      {
        name,
        description,
        category,
        template_data: template_data || {},
        is_public: Boolean(is_public),
        tags: tags || []
      },
      { where: { id } }
    );

    await logAuditAction(userId, 'UPDATE_TEMPLATE', 'template', id, {
      name,
      category,
      is_public
    });

    res.json({ message: 'Template updated successfully' });
  } catch (error) {
    console.error('Template update error:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Delete template
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const template = await Template.findOne({ where: { id, created_by: userId }, raw: true });
    if (!template) {
      return res.status(404).json({ error: 'Template not found or access denied' });
    }

    await Template.destroy({ where: { id } });

    await logAuditAction(userId, 'DELETE_TEMPLATE', 'template', id, {
      name: template.name
    });

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Template deletion error:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// Get template categories
router.get('/meta/categories', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const categories = await Template.findAll({
      where: {
        [Op.or]: [{ is_public: true }, { organization_id: organizationId }]
      },
      attributes: ['category', [fn('COUNT', col('id')), 'count']],
      group: ['category'],
      order: [[fn('COUNT', col('id')), 'DESC']],
      raw: true
    });

    res.json(categories);
  } catch (error) {
    console.error('Categories fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

export default router;
