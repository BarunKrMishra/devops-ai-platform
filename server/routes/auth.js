import '../config/env.js';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { Organization, User, OrganizationInvite, Team, TeamMember, LoginAttempt } from '../models/index.js';
import axios from 'axios';
import { authenticateToken } from '../middleware/auth.js';
import { logAuditAction } from '../utils/audit.js';
import { createEmailTransport } from '../utils/email.js';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import fs from 'fs';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const NODE_ENV = process.env.NODE_ENV || 'development';

const getJwtSecret = () => {
  if (!JWT_SECRET) {
    throw new Error('JWT secret is not configured.');
  }
  return JWT_SECRET;
};

// Constant-time string comparison to avoid timing attacks on OTP checks.
const timingSafeEqualStr = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
};

// Allowed roles for registration
const ALLOWED_ROLES = ['admin', 'manager', 'developer', 'user', 'viewer'];

const normalizeSlug = (value) => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const createOrganizationForEmail = async (email) => {
  const domain = email.split('@')[1] || '';
  const base = normalizeSlug(domain || email.split('@')[0] || 'workspace');
  let slug = base || 'workspace';

  const existing = await Organization.findOne({ where: { slug }, raw: true });
  if (existing) {
    slug = `${slug}-${crypto.randomBytes(3).toString('hex')}`;
  }

  const name = domain ? `${domain} workspace` : 'Aikya workspace';
  const organization = await Organization.create({ name, slug, plan: 'free' });
  return organization.id;
};

// Email transporter setup (use environment variables in production)
const emailFrom = process.env.EMAIL_FROM || process.env.EMAIL_USER;
let transporter = createEmailTransport();

if (transporter) {
  transporter.verify(function(error) {
    if (error) {
      console.error('Email transporter verification failed:', error);
    } else {
      console.log('Email transporter is ready to send messages');
    }
  });
} else {
  console.warn('Email credentials not configured. Email functionality will be disabled.');
  console.warn('Set EMAIL_USER and EMAIL_PASS environment variables to enable email features.');
}

// Helper function to send email with fallback
async function sendEmailWithFallback(emailOptions) {
  if (!transporter) {
    console.log('Email not sent - transporter not configured. Email options:', emailOptions);
    if (NODE_ENV === 'development') {
      console.log(`[DEV MODE] Email would be sent to ${emailOptions.to}:`);
      console.log(`[DEV MODE] Subject: ${emailOptions.subject}`);
      console.log(`[DEV MODE] Body: ${emailOptions.text}`);
      return { success: true, devMode: true };
    }
    throw new Error('Email service not configured');
  }

  const maxAttempts = 3;
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      const result = await transporter.sendMail(emailOptions);
      console.log('Email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      attempt += 1;
      if (attempt >= maxAttempts) {
        console.error('Email sending failed:', error);
        throw error;
      }
      const delay = 500 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

const buildOtpEmail = ({ title, intro, otp }) => {
  return {
    text: `${title}\n\n${intro}\n\nOTP: ${otp}\n\nThis code expires in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; background: #0f172a; color: #e2e8f0; padding: 24px;">
        <h2 style="color: #fbbf24;">${title}</h2>
        <p>${intro}</p>
        <div style="font-size: 20px; font-weight: bold; letter-spacing: 4px; margin: 16px 0;">${otp}</div>
        <p>This code expires in 10 minutes.</p>
      </div>
    `
  };
};

// Utility function to log user contact
function logUserContact(email, action) {
  const logLine = `${new Date().toISOString()},${action},${email}\n`;
  fs.appendFile('user_contacts.log', logLine, err => {
    if (err) console.error('Failed to log user contact:', err);
  });
}

async function acceptPendingInvite(invite, userId) {
  if (!invite) {
    return;
  }
  try {
    const teamIds = Array.isArray(invite.team_ids) ? invite.team_ids : [];
    if (teamIds.length > 0) {
      const teams = await Team.findAll({
        where: {
          organization_id: invite.organization_id,
          id: { [Op.in]: teamIds }
        },
        attributes: ['id'],
        raw: true
      });

      for (const team of teams) {
        await TeamMember.findOrCreate({
          where: { team_id: team.id, user_id: userId },
          defaults: { organization_id: invite.organization_id, role: 'member' }
        });
      }
    }

    await OrganizationInvite.update(
      { status: 'accepted', accepted_at: new Date() },
      { where: { id: invite.id } }
    );
  } catch (inviteError) {
    console.error('Invite acceptance failed:', inviteError);
  }
}

const upsertGitHubUser = async ({ githubId, email, name, accessToken }) => {
  let user = await User.findOne({ where: { github_id: githubId } });
  if (user) {
    await User.update({ github_token: accessToken }, { where: { id: user.id } });
    return user;
  }

  const existingByEmail = await User.findOne({ where: { email } });
  if (existingByEmail) {
    await User.update(
      {
        github_id: githubId,
        github_token: accessToken,
        name: existingByEmail.name || name
      },
      { where: { id: existingByEmail.id } }
    );
    return existingByEmail;
  }

  const pendingInvite = await OrganizationInvite.findOne({
    where: {
      email,
      status: 'pending',
      [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: new Date() } }]
    }
  });

  const resolvedRole = pendingInvite ? pendingInvite.role : 'admin';
  const resolvedOrganizationId = pendingInvite
    ? pendingInvite.organization_id
    : await createOrganizationForEmail(email);

  const secret = speakeasy.generateSecret({ name: `Aikya (${email})` });

  user = await User.create({
    email,
    github_id: githubId,
    role: resolvedRole,
    organization_id: resolvedOrganizationId,
    is_active: true,
    two_factor_secret: secret.base32,
    github_token: accessToken,
    name
  });

  await acceptPendingInvite(pendingInvite, user.id);

  return user;
};

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, role = 'developer', twoFactorMethod = 'totp', twoFactorToken } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!twoFactorToken) {
      await User.destroy({ where: { email, is_active: false } });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const defaultName = email.split('@')[0];

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const existingUser = await User.findOne({ where: { email, is_active: true }, raw: true });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const pendingInvite = await OrganizationInvite.findOne({
      where: {
        email,
        status: 'pending',
        [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: new Date() } }]
      }
    });

    let resolvedOrganizationId = pendingInvite ? pendingInvite.organization_id : null;
    let resolvedRole = pendingInvite ? pendingInvite.role : 'admin';
    let createdOrganizationId = null;
    let tempUser = null;

    if (twoFactorToken) {
      tempUser = await User.findOne({ where: { email, is_active: false } });
      if (tempUser) {
        resolvedOrganizationId = tempUser.organization_id;
        resolvedRole = tempUser.role || resolvedRole;
      }
    }

    if (!pendingInvite && !twoFactorToken) {
      createdOrganizationId = await createOrganizationForEmail(email);
      resolvedOrganizationId = createdOrganizationId;
    }

    if (!resolvedOrganizationId && !twoFactorToken) {
      return res.status(400).json({ error: 'Organization could not be resolved for this registration.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    let secret = null;
    let qr = null;
    if (twoFactorMethod === 'totp' && !twoFactorToken) {
      secret = speakeasy.generateSecret({ name: `Aikya (${email})` });
      qr = await qrcode.toDataURL(secret.otpauth_url);
    }

    if (!twoFactorToken) {
      const tempUser = await User.create({
        email,
        password_hash: passwordHash,
        role: resolvedRole,
        organization_id: resolvedOrganizationId,
        two_factor_enabled: true,
        two_factor_secret: secret ? secret.base32 : null,
        two_factor_method: twoFactorMethod,
        is_active: false,
        name: defaultName
      });

      const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
      const expiry = new Date(Date.now() + 10 * 60 * 1000);
      await User.update({ reset_otp: otp, otp_expiry: expiry }, { where: { id: tempUser.id } });
      console.log(`Generated registration OTP for ${email}`);

      try {
        const otpContent = buildOtpEmail({
          title: 'Complete Your Registration',
          intro: 'Use the OTP below to finish setting up your Aikya account.',
          otp
        });
        await sendEmailWithFallback({
          from: emailFrom,
          to: email,
          subject: 'Complete Your Registration - OTP Required',
          text: otpContent.text,
          html: otpContent.html
        });
      } catch (e) {
        console.error('Email sending error:', e);
        await User.destroy({ where: { id: tempUser.id } });
        if (createdOrganizationId) {
          await Organization.destroy({ where: { id: createdOrganizationId } });
        }

        if (e.message === 'Email service not configured') {
          return res.status(500).json({
            error: 'Email service not configured. Please contact administrator.'
          });
        }

        return res.status(500).json({
          error: 'Failed to send OTP email. Please try again later.',
          // Never leak internal error details to the client in production.
          ...(NODE_ENV === 'development' ? { details: e.message } : {})
        });
      }

      return res.status(200).json({
        twoFactorRequired: true,
        method: 'email',
        message: 'OTP sent to email to complete registration',
        tempUserId: tempUser.id
      });
    }

    if (!tempUser) {
      tempUser = await User.findOne({ where: { email, is_active: false } });
    }
    if (!tempUser) {
      console.error('[REGISTRATION] No pending user found for email:', email);
      return res.status(400).json({ error: 'No pending registration found for this email. Please start registration again.' });
    }

    let verified = false;

    // Prefer the emailed OTP; fall back to the TOTP authenticator code.
    if (tempUser.reset_otp && tempUser.otp_expiry) {
      if (timingSafeEqualStr(tempUser.reset_otp, twoFactorToken) && new Date() < new Date(tempUser.otp_expiry)) {
        verified = true;
      }
    }

    if (!verified && tempUser.two_factor_secret) {
      verified = speakeasy.totp.verify({
        secret: tempUser.two_factor_secret,
        encoding: 'base32',
        token: twoFactorToken,
        window: 1
      });
    }

    if (!verified) {
      await User.destroy({ where: { id: tempUser.id } });
      return res.status(403).json({ error: 'Invalid or expired OTP. Please try registering again.' });
    }

    await User.update(
      { is_active: true, reset_otp: null, otp_expiry: null, last_login: new Date() },
      { where: { id: tempUser.id } }
    );

    await acceptPendingInvite(pendingInvite, tempUser.id);

    logUserContact(email, 'register');

    const permissions = tempUser.permissions || {};
    const user = {
      id: tempUser.id,
      email,
      role: tempUser.role,
      organization_id: tempUser.organization_id,
      permissions,
      name: tempUser.name
    };

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        organization_id: user.organization_id,
        permissions,
        name: user.name
      },
      getJwtSecret(),
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user,
      twoFA: {
        qr,
        secret: secret ? secret.base32 : null,
        method: twoFactorMethod
      },
      message: 'Registration completed successfully!'
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: NODE_ENV === 'development' ? error.message : 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password, twoFactorToken } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    if (!email || !password) {
      await LoginAttempt.create({ email, success: false, ip_address: ip });
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      await LoginAttempt.create({ email, success: false, ip_address: ip });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!user.is_active) {
      await LoginAttempt.create({ email, success: false, ip_address: ip });
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash || '');
    if (!validPassword) {
      await LoginAttempt.create({ email, success: false, ip_address: ip });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!twoFactorToken) {
      const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
      const expiry = new Date(Date.now() + 10 * 60 * 1000);
      user.reset_otp = otp;
      user.otp_expiry = expiry;
      await user.save();
      console.log(`Generated login OTP for ${email}`);
      try {
        const otpContent = buildOtpEmail({
          title: 'Your Login OTP',
          intro: 'Enter this code to complete your login to Aikya.',
          otp
        });
        await sendEmailWithFallback({
          from: emailFrom,
          to: email,
          subject: 'Your Login OTP',
          text: otpContent.text,
          html: otpContent.html
        });
      } catch (e) {
        console.error('Nodemailer error:', e);
        return res.status(500).json({ error: 'Failed to send OTP email', method: 'email' });
      }
      return res.status(200).json({
        twoFactorRequired: true,
        method: 'email',
        message: 'OTP sent to email'
      });
    }

    let verified = false;

    // Prefer the emailed OTP; fall back to the TOTP authenticator code.
    if (user.reset_otp && user.otp_expiry) {
      if (timingSafeEqualStr(user.reset_otp, twoFactorToken) && new Date() < new Date(user.otp_expiry)) {
        verified = true;
        user.reset_otp = null;
        user.otp_expiry = null;
      }
    }

    if (!verified && user.two_factor_secret) {
      verified = speakeasy.totp.verify({
        secret: user.two_factor_secret,
        encoding: 'base32',
        token: twoFactorToken,
        window: 1
      });
    }

    if (!verified) {
      await LoginAttempt.create({ email, success: false, ip_address: ip });
      return res.status(403).json({ error: 'Invalid 2FA code' });
    }

    user.last_login = new Date();
    await user.save();

    const permissions = user.permissions || {};
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        organization_id: user.organization_id,
        permissions,
        name: user.name
      },
      getJwtSecret(),
      { expiresIn: '24h' }
    );

    await LoginAttempt.create({ email, success: true, ip_address: ip });
    logUserContact(email, 'login');

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        organization_id: user.organization_id,
        name: user.name,
        permissions
      }
    });
  } catch (error) {
    const { email } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    await LoginAttempt.create({ email, success: false, ip_address: ip });
    console.error('Login error:', error);
    res.status(500).json({ error: NODE_ENV === 'development' ? error.message : 'Login failed' });
  }
});

// GitHub OAuth (simplified - in production, use proper OAuth flow)
router.post('/github', async (req, res) => {
  try {
    const { code, redirectUri } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
      return res.status(500).json({ error: 'GitHub OAuth is not configured' });
    }

    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri
      },
      {
        headers: {
          Accept: 'application/json'
        }
      }
    );

    const { access_token } = tokenResponse.data;

    if (!access_token) {
      return res.status(400).json({ error: 'Failed to retrieve GitHub access token' });
    }

    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: 'application/vnd.github+json'
      }
    });

    const githubId = String(userResponse.data.id);
    let email = userResponse.data.email;
    const name = userResponse.data.name || userResponse.data.login;

    if (!email) {
      const emailsResponse = await axios.get('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: 'application/vnd.github+json'
        }
      });

      const primaryEmail = emailsResponse.data.find(
        (item) => item.primary && item.verified
      );
      email = primaryEmail?.email || emailsResponse.data[0]?.email;
    }

    if (!email) {
      return res.status(400).json({ error: 'GitHub email not available' });
    }

    const user = await upsertGitHubUser({
      githubId,
      email,
      name,
      accessToken: access_token
    });

    const permissions = user.permissions || {};
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        organization_id: user.organization_id,
        permissions,
        name: user.name
      },
      getJwtSecret(),
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        organization_id: user.organization_id,
        name: user.name,
        permissions
      }
    });
  } catch (error) {
    console.error('GitHub OAuth error:', error.response?.data || error);
    res.status(500).json({ error: 'GitHub authentication failed' });
  }
});

// GitHub OAuth callback
router.get('/github/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    const redirectUri = req.query.redirect_uri;
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri
      },
      {
        headers: {
          Accept: 'application/json'
        }
      }
    );

    const { access_token } = tokenResponse.data;
    if (!access_token) {
      return res.status(400).json({ error: 'Failed to retrieve GitHub access token' });
    }

    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: 'application/vnd.github+json'
      }
    });

    const githubId = String(userResponse.data.id);
    let email = userResponse.data.email;
    const name = userResponse.data.name || userResponse.data.login;

    if (!email) {
      const emailsResponse = await axios.get('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: 'application/vnd.github+json'
        }
      });

      const primaryEmail = emailsResponse.data.find(
        (item) => item.primary && item.verified
      );
      email = primaryEmail?.email || emailsResponse.data[0]?.email;
    }

    if (!email) {
      return res.status(400).json({ error: 'GitHub email not available' });
    }

    const user = await upsertGitHubUser({
      githubId,
      email,
      name,
      accessToken: access_token
    });

    const permissions = user.permissions || {};
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        organization_id: user.organization_id,
        permissions,
        name: user.name
      },
      getJwtSecret(),
      { expiresIn: '24h' }
    );

    await User.update({ last_login: new Date() }, { where: { id: user.id } });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        permissions
      }
    });
  } catch (error) {
    console.error('GitHub OAuth error:', error.response?.data || error);
    res.status(500).json({ error: 'Failed to authenticate with GitHub' });
  }
});

// Disconnect GitHub
router.post('/github/disconnect', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    await User.update({ github_token: null }, { where: { id: userId } });

    await logAuditAction(userId, 'GITHUB_DISCONNECT', 'user', userId);

    res.json({ message: 'GitHub account disconnected successfully' });
  } catch (error) {
    console.error('GitHub disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect GitHub account' });
  }
});

// Request password reset (send OTP)
router.post('/request-password-reset', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      // Do not reveal whether an account exists (prevents email enumeration).
      // Respond with the same generic message as the success path.
      return res.json({ message: 'If an account exists for this email, an OTP has been sent.' });
    }

    const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    user.reset_otp = otp;
    user.otp_expiry = expiry;
    await user.save();

    try {
      const otpContent = buildOtpEmail({
        title: 'Reset Your Password',
        intro: 'Use the OTP below to reset your password for Aikya.',
        otp
      });
      const emailResult = await sendEmailWithFallback({
        from: emailFrom || 'noreply@devopsai.com',
        to: email,
        subject: 'Your Password Reset OTP',
        text: otpContent.text,
        html: otpContent.html
      });

      if (emailResult.devMode) {
        res.json({
          message: 'OTP sent to email (dev mode)',
          devOtp: otp,
          devMode: true
        });
      } else {
        res.json({ message: 'If an account exists for this email, an OTP has been sent.' });
      }
    } catch (emailError) {
      console.error('Email sending error:', emailError);

      if (emailError.message === 'Email service not configured') {
        if (NODE_ENV === 'development') {
          return res.json({
            message: 'OTP generated (email not configured)',
            devOtp: otp,
            devMode: true,
            warning: 'Email service not configured'
          });
        } else {
          return res.status(500).json({
            error: 'Email service not configured. Please contact administrator.'
          });
        }
      }

      res.status(500).json({
        error: 'Failed to send email. Please try again later.',
        ...(NODE_ENV === 'development' ? { details: emailError.message } : {})
      });
    }
  } catch (error) {
    console.error('Unexpected error in request-password-reset:', error);
    res.status(500).json({
      error: 'An unexpected error occurred. Please try again.',
      ...(NODE_ENV === 'development' ? { details: error.message } : {})
    });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });
  const user = await User.findOne({ where: { email } });
  if (!user || !user.reset_otp || !user.otp_expiry) return res.status(400).json({ error: 'No OTP set' });
  if (!timingSafeEqualStr(user.reset_otp, otp)) return res.status(400).json({ error: 'Invalid OTP' });
  if (new Date() > new Date(user.otp_expiry)) return res.status(400).json({ error: 'OTP expired' });
  res.json({ message: 'OTP verified' });
});

// Reset password
router.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) return res.status(400).json({ error: 'All fields required' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  const user = await User.findOne({ where: { email } });
  if (!user || !user.reset_otp || !user.otp_expiry) return res.status(400).json({ error: 'No OTP set' });
  if (!timingSafeEqualStr(user.reset_otp, otp)) return res.status(400).json({ error: 'Invalid OTP' });
  if (new Date() > new Date(user.otp_expiry)) return res.status(400).json({ error: 'OTP expired' });
  const passwordHash = await bcrypt.hash(newPassword, 12);
  user.password_hash = passwordHash;
  user.reset_otp = null;
  user.otp_expiry = null;
  await user.save();
  res.json({ message: 'Password reset successful' });
});

// 2FA Setup (generate secret and QR)
router.post('/enable-2fa', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  const user = await User.findOne({ where: { email } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  const secret = speakeasy.generateSecret({ name: `Aikya (${email})` });
  user.two_factor_secret = secret.base32;
  await user.save();
  const qr = await qrcode.toDataURL(secret.otpauth_url);
  res.json({ qr, secret: secret.base32 });
});

// 2FA Verify (during setup or login)
router.post('/verify-2fa', async (req, res) => {
  const { email, token } = req.body;
  if (!email || !token) return res.status(400).json({ error: 'Email and token required' });
  const user = await User.findOne({ where: { email } });
  if (!user || !user.two_factor_secret) return res.status(400).json({ error: '2FA not set up' });
  const verified = speakeasy.totp.verify({
    secret: user.two_factor_secret,
    encoding: 'base32',
    token,
    window: 1
  });
  if (!verified) return res.status(400).json({ error: 'Invalid 2FA code' });
  if (!user.two_factor_enabled) {
    user.two_factor_enabled = true;
    await user.save();
  }
  res.json({ message: '2FA verified' });
});

export default router;
