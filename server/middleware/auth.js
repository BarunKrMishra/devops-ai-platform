import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, UserApiKey } from '../models/index.js';

const JWT_SECRET = process.env.JWT_SECRET;

// Resolve a request authenticated via a personal API key (X-API-Key header).
// Returns a user payload shaped like the JWT payload, or null if invalid.
const resolveApiKeyUser = async (apiKey) => {
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const record = await UserApiKey.findOne({ where: { key_hash: keyHash, is_active: true } });
  if (!record) {
    return null;
  }
  const user = await User.findByPk(record.user_id, {
    attributes: ['id', 'email', 'role', 'organization_id', 'permissions', 'name', 'is_active'],
    raw: true
  });
  if (!user || user.is_active === false) {
    return null;
  }
  // Best-effort last-used tracking (never blocks the request).
  UserApiKey.update({ last_used: new Date() }, { where: { id: record.id } }).catch(() => {});
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    organization_id: user.organization_id,
    permissions: user.permissions || {},
    name: user.name
  };
};

// Middleware to authenticate a request and attach user info to req.user.
// Accepts a Bearer JWT (primary) or an X-API-Key personal key (fallback).
export const authenticateToken = async (req, res, next) => {
  if (!JWT_SECRET) {
    return res.status(500).json({ error: 'JWT secret is not configured.' });
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  const apiKey = req.headers['x-api-key'];

  // Bearer JWT takes precedence.
  if (token) {
    return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid token' });
      }
      req.user = user;
      next();
    });
  }

  // Fall back to a personal API key.
  if (apiKey) {
    try {
      const user = await resolveApiKeyUser(apiKey);
      if (!user) {
        return res.status(403).json({ error: 'Invalid API key' });
      }
      req.user = user;
      return next();
    } catch (error) {
      return res.status(500).json({ error: 'Authentication error' });
    }
  }

  return res.status(401).json({ error: 'Access token required' });
};

const resolvePermissions = (user) => {
  if (!user || user.permissions === undefined || user.permissions === null) {
    return {};
  }
  if (typeof user.permissions === 'string') {
    try {
      return JSON.parse(user.permissions);
    } catch (error) {
      return {};
    }
  }
  return user.permissions;
};

export const hasOpsAccess = (user, moduleKey) => {
  if (!user || !moduleKey) {
    return false;
  }
  if (user.role === 'admin' || user.role === 'manager') {
    return true;
  }
  const permissions = resolvePermissions(user);
  const opsAccess = permissions.ops_access;
  if (!Array.isArray(opsAccess)) {
    return true;
  }
  return opsAccess.includes(moduleKey);
};

// Middleware to require a specific role or roles
export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

export const requireOpsAccess = (moduleKey) => {
  return (req, res, next) => {
    if (!hasOpsAccess(req.user, moduleKey)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};
