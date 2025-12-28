import { db } from '../database/init.js';

export const logAuditAction = async (userId, action, resourceType, resourceId, details = {}, ipAddress = null) => {
  try {
    const user = db.prepare('SELECT organization_id FROM users WHERE id = ?').get(userId);
    const organizationId = user?.organization_id || null;
    db.prepare(
      'INSERT INTO audit_logs (user_id, organization_id, action, resource_type, resource_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(userId, organizationId, action, resourceType, resourceId, JSON.stringify(details), ipAddress);
  } catch (error) {
    console.error('Audit logging error:', error);
  }
};
