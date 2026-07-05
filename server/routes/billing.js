import express from 'express';
import { User, OpsModule, OrganizationOps, OpsPurchaseRequest } from '../models/index.js';
import { requireRole } from '../middleware/auth.js';
import { billingCurrency, billingEnabled } from '../config/billing.js';
import { logAuditAction } from '../utils/audit.js';

const router = express.Router();

router.get('/status', (req, res) => {
  res.json({
    enabled: billingEnabled,
    currency: billingCurrency
  });
});

router.get('/summary', requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const organizationId = req.user.organization_id;

    const [seatCount, modules, orgOps] = await Promise.all([
      User.count({ where: { organization_id: organizationId, is_active: true } }),
      OpsModule.findAll({ order: [['category', 'ASC'], ['name', 'ASC']], raw: true }),
      OrganizationOps.findAll({ where: { organization_id: organizationId }, raw: true })
    ]);

    const enabledSet = new Set(
      orgOps.filter((entry) => entry.enabled).map((entry) => entry.module_key)
    );

    const enabledModules = modules
      .filter((module) => enabledSet.has(module.key))
      .map((module) => ({ key: module.key, name: module.name }));

    res.json({
      enabled: billingEnabled,
      currency: billingCurrency,
      seats: seatCount,
      modules: enabledModules
    });
  } catch (error) {
    console.error('Billing summary error:', error);
    res.status(500).json({ error: 'Failed to load billing summary.' });
  }
});

router.get('/requests', requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const requests = await OpsPurchaseRequest.findAll({
      where: { organization_id: organizationId },
      order: [['created_at', 'DESC']],
      raw: true
    });

    res.json(requests);
  } catch (error) {
    console.error('Billing requests fetch error:', error);
    res.status(500).json({ error: 'Failed to load purchase requests.' });
  }
});

router.post('/requests', requireRole(['admin', 'manager']), async (req, res) => {
  try {
    if (!billingEnabled) {
      return res.status(400).json({ error: 'Billing is disabled. Enable the module directly.' });
    }

    const organizationId = req.user.organization_id;
    const userId = req.user.id;
    const { module_key, notes } = req.body || {};

    if (!module_key) {
      return res.status(400).json({ error: 'module_key is required.' });
    }

    const moduleExists = await OpsModule.findOne({ where: { key: module_key }, raw: true });
    if (!moduleExists) {
      return res.status(404).json({ error: 'Ops module not found.' });
    }

    const existing = await OrganizationOps.findOne({
      where: { organization_id: organizationId, module_key },
      raw: true
    });
    if (existing?.enabled) {
      return res.status(409).json({ error: 'Ops module is already enabled.' });
    }

    const pending = await OpsPurchaseRequest.findOne({
      where: { organization_id: organizationId, module_key, status: 'pending' },
      raw: true
    });
    if (pending) {
      return res.json(pending);
    }

    const request = await OpsPurchaseRequest.create({
      organization_id: organizationId,
      module_key,
      requested_by: userId,
      status: 'pending',
      notes: notes || null
    });

    await logAuditAction(userId, 'REQUEST_OPS_PURCHASE', 'ops_module', module_key, {
      module_key
    });

    res.status(201).json(request);
  } catch (error) {
    console.error('Billing request create error:', error);
    res.status(500).json({ error: 'Failed to submit purchase request.' });
  }
});

router.patch('/requests/:id', requireRole(['admin']), async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const userId = req.user.id;
    const { id } = req.params;
    const { status } = req.body || {};

    if (!['approved', 'rejected', 'pending'].includes(String(status))) {
      return res.status(400).json({ error: 'Invalid status value.' });
    }

    const request = await OpsPurchaseRequest.findOne({
      where: { id, organization_id: organizationId }
    });

    if (!request) {
      return res.status(404).json({ error: 'Purchase request not found.' });
    }

    await OpsPurchaseRequest.update({ status }, { where: { id } });

    await logAuditAction(userId, 'UPDATE_OPS_PURCHASE_REQUEST', 'ops_purchase_request', id, {
      status
    });

    res.json({ message: 'Request updated.', status });
  } catch (error) {
    console.error('Billing request update error:', error);
    res.status(500).json({ error: 'Failed to update request.' });
  }
});

export default router;
