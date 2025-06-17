import { db } from '../database/init.js';

export const logAuditAction = async (userId, action, resourceType, resourceId, details = {}, ipAddress = null) => {
  try {
    db.prepare(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(userId, action, resourceType, resourceId, JSON.stringify(details), ipAddress);
  } catch (error) {
    console.error('Audit logging error:', error);
  }
};