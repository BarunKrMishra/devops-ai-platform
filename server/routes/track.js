import express from 'express';
import jwt from 'jsonwebtoken';
import { PageView } from '../models/index.js';

// Public visit-tracking endpoint. Records anonymous visitors too; if a valid
// session token is present it links the view to that user. Deliberately never
// returns an error to the client — tracking must not affect the app.
const router = express.Router();

const softDecodeUser = (req) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token || !process.env.JWT_SECRET) {
    return null;
  }
  try {
    return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
};

const clientIp = (req) =>
  String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '')
    .split(',')[0]
    .trim()
    .slice(0, 64);

const cap = (value, len) => (value ? String(value).slice(0, len) : null);

router.post('/view', async (req, res) => {
  try {
    const { path, referrer, sessionId } = req.body || {};
    const user = softDecodeUser(req);

    await PageView.create({
      session_id: cap(sessionId, 100),
      user_id: user?.id || null,
      organization_id: user?.organization_id || null,
      email: user?.email || null,
      path: cap(path, 300),
      referrer: cap(referrer, 300),
      ip_address: clientIp(req),
      user_agent: cap(req.headers['user-agent'], 500)
    });
  } catch (error) {
    // Swallow — tracking failures must never surface to the visitor.
  }
  res.status(204).end();
});

export default router;
