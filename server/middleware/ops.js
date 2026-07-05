import { OrganizationOps } from '../models/index.js';

export const isOpsEnabled = async (organizationId, moduleKey) => {
  if (!organizationId || !moduleKey) {
    return false;
  }
  const row = await OrganizationOps.findOne({
    where: { organization_id: organizationId, module_key: moduleKey },
    attributes: ['enabled']
  });
  return Boolean(row?.enabled);
};

export const requireOpsEnabled = (moduleKey) => {
  return async (req, res, next) => {
    const organizationId = req.user?.organization_id;
    if (!(await isOpsEnabled(organizationId, moduleKey))) {
      return res.status(403).json({ error: 'Ops module is not enabled.' });
    }
    next();
  };
};
