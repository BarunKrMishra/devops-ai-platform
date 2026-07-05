import express from 'express';
import { OpsModule, OrganizationOps, OpsPurchaseRequest } from '../models/index.js';
import { requireRole } from '../middleware/auth.js';
import { billingEnabled } from '../config/billing.js';

const router = express.Router();

router.get('/modules', async (req, res) => {
  const orgId = req.user.organization_id;

  try {
    const [modules, orgOps] = await Promise.all([
      OpsModule.findAll({ order: [['category', 'ASC'], ['name', 'ASC']], raw: true }),
      OrganizationOps.findAll({ where: { organization_id: orgId }, raw: true })
    ]);

    const orgOpsMap = orgOps.reduce((acc, row) => {
      acc[row.module_key] = row;
      return acc;
    }, {});

    const response = modules.map((module) => {
      const orgRow = orgOpsMap[module.key] || {};
      return {
        key: module.key,
        name: module.name,
        category: module.category,
        description: module.description,
        ai_enabled: Boolean(module.ai_enabled),
        metadata: module.metadata || {},
        enabled: Boolean(orgRow.enabled),
        configured: Boolean(orgRow.configured)
      };
    });

    res.json(response);
  } catch (error) {
    console.error('Ops modules fetch error:', error);
    res.status(500).json({ error: 'Failed to load ops modules.' });
  }
});

router.patch('/modules/:key', requireRole(['admin', 'manager']), async (req, res) => {
  const orgId = req.user.organization_id;
  const moduleKey = req.params.key;
  const { enabled, configured } = req.body || {};

  if (enabled === undefined && configured === undefined) {
    return res.status(400).json({ error: 'Provide enabled or configured state.' });
  }

  const moduleExists = await OpsModule.findOne({ where: { key: moduleKey } });
  if (!moduleExists) {
    return res.status(404).json({ error: 'Ops module not found.' });
  }

  const existing = await OrganizationOps.findOne({ where: { organization_id: orgId, module_key: moduleKey } });
  const nextEnabled = enabled !== undefined ? Boolean(enabled) : Boolean(existing?.enabled);
  const nextConfigured = configured !== undefined ? Boolean(configured) : Boolean(existing?.configured);

  if (billingEnabled && enabled === true && !existing?.enabled) {
    const approvedRequest = await OpsPurchaseRequest.findOne({
      where: { organization_id: orgId, module_key: moduleKey, status: 'approved' },
      raw: true
    });
    if (!approvedRequest) {
      return res.status(402).json({
        error: 'Billing is active. Submit a purchase request before enabling this ops module.'
      });
    }
  }

  if (existing) {
    await OrganizationOps.update(
      { enabled: nextEnabled, configured: nextConfigured },
      { where: { organization_id: orgId, module_key: moduleKey } }
    );
  } else {
    await OrganizationOps.create({
      organization_id: orgId,
      module_key: moduleKey,
      enabled: nextEnabled,
      configured: nextConfigured
    });
  }

  res.json({
    key: moduleKey,
    enabled: nextEnabled,
    configured: nextConfigured
  });
});

export default router;
