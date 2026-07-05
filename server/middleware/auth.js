import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

// Middleware to authenticate JWT token and attach user info to req.user
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  if (!JWT_SECRET) {
    return res.status(500).json({ error: 'JWT secret is not configured.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
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
