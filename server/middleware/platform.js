import { PlatformAdmin } from '../models/index.js';

// Platform (Aikya team) super-admin access.
//
// Two tiers, both cross-organization:
//  - ROOT admins come from the PLATFORM_ADMIN_EMAILS env allow-list. They are
//    the bootstrap owners and are the only ones who can add/remove team admins.
//    They cannot be removed from the UI (only by editing the env).
//  - TEAM admins live in the platform_admins table and are added by a root
//    admin from the admin panel. They get full platform access but cannot
//    manage the admin team.
//
// This is deliberately separate from the per-organization role system: a
// customer can never grant themselves platform access.

const parseAdminEmails = () =>
  String(process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export const isRootAdmin = (user) => {
  if (!user || !user.email) {
    return false;
  }
  return parseAdminEmails().includes(String(user.email).toLowerCase());
};

export const isPlatformAdmin = async (user) => {
  if (!user || !user.email) {
    return false;
  }
  if (isRootAdmin(user)) {
    return true;
  }
  const email = String(user.email).toLowerCase();
  const record = await PlatformAdmin.findOne({ where: { email } });
  return Boolean(record);
};

// Gate a route to any Aikya platform admin (root or team). Runs after auth.
export const requirePlatformAdmin = async (req, res, next) => {
  try {
    if (await isPlatformAdmin(req.user)) {
      req.isRootAdmin = isRootAdmin(req.user);
      return next();
    }
  } catch (error) {
    console.error('Platform admin check failed:', error);
    return res.status(500).json({ error: 'Authorization check failed.' });
  }
  return res.status(403).json({ error: 'Platform admin access required.' });
};

// Gate a route to ROOT admins only (managing the admin team).
export const requireRootAdmin = (req, res, next) => {
  if (!isRootAdmin(req.user)) {
    return res.status(403).json({ error: 'Root platform admin access required.' });
  }
  next();
};
