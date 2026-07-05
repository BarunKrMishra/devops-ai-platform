import { AuditLog, User } from '../models/index.js';
import { getRequestContext } from './requestContext.js';

export const logAuditAction = async (
  userId,
  action,
  resourceType,
  resourceId,
  details = {},
  ipAddress = null,
  userAgent = null,
  sessionId = null
) => {
  try {
    const user = await User.findByPk(userId, { attributes: ['organization_id'] });
    const organizationId = user?.organization_id || null;
    const context = getRequestContext();
    const resolvedIp = ipAddress || context?.ipAddress || null;
    const resolvedAgent = userAgent || context?.userAgent || null;
    const resolvedSession = sessionId || context?.sessionId || null;

    await AuditLog.create({
      user_id: userId,
      organization_id: organizationId,
      action,
      resource_type: resourceType,
      resource_id: resourceId ? String(resourceId) : null,
      details,
      ip_address: resolvedIp,
      user_agent: resolvedAgent,
      session_id: resolvedSession
    });
  } catch (error) {
    console.error('Audit logging error:', error);
  }
};
