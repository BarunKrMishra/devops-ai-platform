import { AsyncLocalStorage } from 'async_hooks';

const storage = new AsyncLocalStorage();

const normalizeIp = (value) => {
  if (!value) {
    return null;
  }
  let ip = value.trim();
  if (!ip) {
    return null;
  }
  if (ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }
  if (ip.startsWith('::ffff:')) {
    ip = ip.slice(7);
  }
  if (ip === '::1') {
    ip = '127.0.0.1';
  }
  return ip || null;
};

const getIpAddress = (req) => {
  const forwarded = req.headers['x-forwarded-for'] || req.headers['x-real-ip'];
  if (Array.isArray(forwarded)) {
    return normalizeIp(forwarded[0]);
  }
  if (typeof forwarded === 'string') {
    return normalizeIp(forwarded);
  }
  return normalizeIp(req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || null);
};

export const withRequestContext = (req, res, next) => {
  const context = {
    ipAddress: getIpAddress(req),
    userAgent: req.headers['user-agent'] || null,
    sessionId: req.headers['x-session-id'] || null
  };

  storage.run(context, () => next());
};

export const getRequestContext = () => storage.getStore();
