import express from 'express';
import { db } from '../database/init.js';
import { requireRole } from '../middleware/auth.js';
import { logAuditAction } from '../utils/audit.js';

const router = express.Router();

// Get all templates
router.get('/', async (req, res) => {
  try {
    const { category, search, public_only } = req.query;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    let query = `
      SELECT t.*, u.name as created_by_name 
      FROM templates t 
      LEFT JOIN users u ON t.created_by = u.id 
      WHERE (t.is_public = 1 OR t.organization_id = ? OR t.created_by = ?)
    `;
    const params = [organizationId, userId];

    if (category) {
      query += ` AND t.category = ?`;
      params.push(category);
    }

    if (search) {
      query += ` AND (t.name LIKE ? OR t.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (public_only === 'true') {
      query += ` AND t.is_public = 1`;
    }

    query += ` ORDER BY t.downloads DESC, t.created_at DESC`;

    const templates = db.prepare(query).all(...params);

    res.json(templates.map(template => ({
      ...template,
      template_data: JSON.parse(template.template_data),
      tags: JSON.parse(template.tags)
    })));
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

    const template = db.prepare(`
      SELECT t.*, u.name as created_by_name 
      FROM templates t 
      LEFT JOIN users u ON t.created_by = u.id 
      WHERE t.id = ? AND (t.is_public = 1 OR t.organization_id = ? OR t.created_by = ?)
    `).get(id, organizationId, userId);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Increment download count
    db.prepare('UPDATE templates SET downloads = downloads + 1 WHERE id = ?').run(id);

    res.json({
      ...template,
      template_data: JSON.parse(template.template_data),
      tags: JSON.parse(template.tags)
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

    const result = db.prepare(`
      INSERT INTO templates (name, description, category, template_data, is_public, created_by, organization_id, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      description,
      category,
      JSON.stringify(template_data),
      is_public || false,
      userId,
      organizationId,
      JSON.stringify(tags || [])
    );

    await logAuditAction(userId, 'CREATE_TEMPLATE', 'template', result.lastInsertRowid, {
      name,
      category,
      is_public
    });

    res.json({ id: result.lastInsertRowid, message: 'Template created successfully' });
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

    // Check if user owns the template or is admin
    const template = db.prepare('SELECT * FROM templates WHERE id = ? AND created_by = ?').get(id, userId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found or access denied' });
    }

    db.prepare(`
      UPDATE templates 
      SET name = ?, description = ?, category = ?, template_data = ?, is_public = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name,
      description,
      category,
      JSON.stringify(template_data),
      is_public,
      JSON.stringify(tags || []),
      id
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

    // Check if user owns the template or is admin
    const template = db.prepare('SELECT * FROM templates WHERE id = ? AND created_by = ?').get(id, userId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found or access denied' });
    }

    db.prepare('DELETE FROM templates WHERE id = ?').run(id);

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
    const categories = db.prepare(`
      SELECT category, COUNT(*) as count 
      FROM templates 
      WHERE is_public = 1 OR organization_id = ? 
      GROUP BY category 
      ORDER BY count DESC
    `).all(req.user.organization_id);

    res.json(categories);
  } catch (error) {
    console.error('Categories fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

export default router;