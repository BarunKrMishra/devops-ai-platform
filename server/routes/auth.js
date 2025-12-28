import '../config/env.js';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../database/init.js';
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

// Allowed roles for registration
const ALLOWED_ROLES = ['developer', 'manager', 'user'];

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
    // In development, just log the OTP instead of sending email
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

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, role = 'developer', twoFactorMethod = 'totp', twoFactorToken } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Clean up any old pending user with this email
    if (!twoFactorToken) {
      db.prepare('DELETE FROM users WHERE email = ? AND is_active = 0').run(email);
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Password strength validation
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    // Validate role
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const pendingInvite = db.prepare(`
      SELECT * FROM organization_invites
      WHERE email = ? AND status = 'pending' AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))
    `).get(email);
    const resolvedOrganizationId = pendingInvite ? pendingInvite.organization_id : 1;
    const resolvedRole = pendingInvite ? pendingInvite.role : role;

    // Check if user exists
    const existingUser = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    let secret = null;
    let qr = null;
    if (twoFactorMethod === 'totp') {
      secret = speakeasy.generateSecret({ name: `DevOpsAI (${email})` });
      qr = await qrcode.toDataURL(secret.otpauth_url);
    }

    // If no 2FA token provided, create temporary user and send OTP
    if (!twoFactorToken) {
      // Create temporary user with pending status
      const result = db.prepare(
        'INSERT INTO users (email, password_hash, role, organization_id, two_factor_enabled, two_factor_secret, two_factor_method, is_active) VALUES (?, ?, ?, ?, 1, ?, ?, 0)'
      ).run(email, passwordHash, resolvedRole, resolvedOrganizationId, secret ? secret.base32 : null, twoFactorMethod);

      const tempUserId = result.lastInsertRowid;

      // Generate OTP and send email
      const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
      const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min
      db.prepare('UPDATE users SET reset_otp = ?, otp_expiry = ? WHERE id = ?').run(otp, expiry, tempUserId);
      console.log(`Generated registration OTP for ${email}: ${otp}`); // Log OTP for debugging
      
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
        // Clean up temporary user if email fails
        db.prepare('DELETE FROM users WHERE id = ?').run(tempUserId);
        
        if (e.message === 'Email service not configured') {
          return res.status(500).json({ 
            error: 'Email service not configured. Please contact administrator.',
            details: 'Email credentials are missing from environment variables.'
          });
        }
        
        return res.status(500).json({ 
          error: 'Failed to send OTP email. Please try again later.',
          details: e.message 
        });
      }

      return res.status(403).json({ 
        error: 'OTP sent to email to complete registration', 
        method: 'email',
        tempUserId: tempUserId 
      });
    }

    // If 2FA token provided, verify and complete registration
    // Find the temporary user
    const tempUser = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 0').get(email);
    if (!tempUser) {
      // Log all pending users for debugging
      const pendingUsers = db.prepare('SELECT email, reset_otp, otp_expiry FROM users WHERE is_active = 0').all();
      console.error('[REGISTRATION] No pending user found for email:', email, 'All pending users:', pendingUsers);
      return res.status(400).json({ error: 'No pending registration found for this email. Please start registration again.' });
    }

    // Verify 2FA token
    let verified = false;
    
    console.log(`[REGISTRATION] Verifying 2FA for user ${email}:`, {
      hasResetOtp: !!tempUser.reset_otp,
      hasOtpExpiry: !!tempUser.otp_expiry,
      hasTwoFactorSecret: !!tempUser.two_factor_secret,
      providedToken: twoFactorToken,
      expectedOtp: tempUser.reset_otp,
      otpExpiry: tempUser.otp_expiry
    });
    
    // First, check if it's an email OTP
    if (tempUser.reset_otp && tempUser.otp_expiry) {
      if (tempUser.reset_otp === twoFactorToken && new Date() < new Date(tempUser.otp_expiry)) {
        verified = true;
        console.log('[REGISTRATION] Registration email OTP verification successful');
      } else {
        console.log('[REGISTRATION] Registration email OTP verification failed', {
          provided: twoFactorToken,
          expected: tempUser.reset_otp,
          expiry: tempUser.otp_expiry,
          now: new Date().toISOString()
        });
      }
    }
    
    // If email OTP didn't work, try TOTP verification
    if (!verified && tempUser.two_factor_secret) {
      verified = speakeasy.totp.verify({
        secret: tempUser.two_factor_secret,
        encoding: 'base32',
        token: twoFactorToken,
        window: 1
      });
      console.log(`[REGISTRATION] Registration TOTP verification result: ${verified}`);
    }
    
    if (!verified) {
      // Clean up pending user so they can try again
      db.prepare('DELETE FROM users WHERE id = ?').run(tempUser.id);
      return res.status(403).json({ error: 'Invalid or expired OTP. Please try registering again.' });
    }

    // 2FA verified - activate the user and complete registration
    db.prepare('UPDATE users SET is_active = 1, reset_otp = NULL, otp_expiry = NULL, last_login = CURRENT_TIMESTAMP WHERE id = ?').run(tempUser.id);

    if (pendingInvite) {
      try {
        const teamIds = JSON.parse(pendingInvite.team_ids || '[]');
        if (Array.isArray(teamIds) && teamIds.length > 0) {
          const teams = db.prepare(`
            SELECT id FROM teams WHERE organization_id = ? AND id IN (${teamIds.map(() => '?').join(',')})
          `).all(pendingInvite.organization_id, ...teamIds);
          teams.forEach((team) => {
            db.prepare(`
              INSERT OR IGNORE INTO team_members (team_id, user_id, role)
              VALUES (?, ?, 'member')
            `).run(team.id, tempUser.id);
          });
        }
        db.prepare(`
          UPDATE organization_invites
          SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(pendingInvite.id);
      } catch (inviteError) {
        console.error('Invite acceptance during registration failed:', inviteError);
      }
    }

    // Log user contact for sales
    logUserContact(email, 'register');

    const user = {
      id: tempUser.id,
      email,
      role: tempUser.role,
      organization_id: tempUser.organization_id
    };

    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role,
        organization_id: user.organization_id
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
    console.log('Login attempt:', email);
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    if (!email || !password) {
      db.prepare('INSERT INTO login_attempts (email, success, ip_address) VALUES (?, ?, ?)').run(email, 0, ip);
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      db.prepare('INSERT INTO login_attempts (email, success, ip_address) VALUES (?, ?, ?)').run(email, 0, ip);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!user.is_active) {
      db.prepare('INSERT INTO login_attempts (email, success, ip_address) VALUES (?, ?, ?)').run(email, 0, ip);
      return res.status(401).json({ error: 'Account is deactivated' });
    }
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      db.prepare('INSERT INTO login_attempts (email, success, ip_address) VALUES (?, ?, ?)').run(email, 0, ip);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    // Always require 2FA
    if (!twoFactorToken) {
      // Generate OTP and send email
      const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
      const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min
      db.prepare('UPDATE users SET reset_otp = ?, otp_expiry = ? WHERE id = ?').run(otp, expiry, user.id);
      console.log(`Generated OTP for ${email}: ${otp}`); // Log OTP for debugging
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
      return res.status(403).json({ error: 'OTP sent to email', method: 'email' });
    }
    // Verify 2FA token - try email OTP first, then TOTP
    let verified = false;
    
    console.log(`Verifying 2FA for user ${email}:`, {
      hasResetOtp: !!user.reset_otp,
      hasOtpExpiry: !!user.otp_expiry,
      hasTwoFactorSecret: !!user.two_factor_secret,
      providedToken: twoFactorToken
    });
    
    // First, check if it's an email OTP
    if (user.reset_otp && user.otp_expiry) {
      console.log(`Checking email OTP: expected=${user.reset_otp}, provided=${twoFactorToken}, expiry=${user.otp_expiry}`);
      if (user.reset_otp === twoFactorToken && new Date() < new Date(user.otp_expiry)) {
        verified = true;
        console.log('Email OTP verification successful');
        // Clear the used OTP
        db.prepare('UPDATE users SET reset_otp = NULL, otp_expiry = NULL WHERE id = ?').run(user.id);
      } else {
        console.log('Email OTP verification failed');
      }
    }
    
    // If email OTP didn't work, try TOTP verification
    if (!verified && user.two_factor_secret) {
      console.log(`Attempting TOTP verification with secret: ${user.two_factor_secret.substring(0, 10)}...`);
      verified = speakeasy.totp.verify({
        secret: user.two_factor_secret,
        encoding: 'base32',
        token: twoFactorToken,
        window: 1
      });
      console.log(`TOTP verification result: ${verified}`);
    }
    
    if (!verified) {
      console.log(`2FA verification failed for user ${email}`);
      db.prepare('INSERT INTO login_attempts (email, success, ip_address) VALUES (?, ?, ?)').run(email, 0, ip);
      return res.status(403).json({ error: 'Invalid 2FA code' });
    }
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role, 
        organization_id: user.organization_id 
      },
      getJwtSecret(),
      { expiresIn: '24h' }
    );
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
    db.prepare('INSERT INTO login_attempts (email, success, ip_address) VALUES (?, ?, ?)').run(email, 1, ip);
    // Log user contact for sales
    logUserContact(email, 'login');
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        organization_id: user.organization_id,
        name: user.name,
        permissions: JSON.parse(user.permissions || '{}')
      }
    });
  } catch (error) {
    const { email } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    db.prepare('INSERT INTO login_attempts (email, success, ip_address) VALUES (?, ?, ?)').run(email, 0, ip);
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

    let user = db.prepare('SELECT * FROM users WHERE github_id = ?').get(githubId);
    const secret = speakeasy.generateSecret({ name: `Aikya (${email})` });

    if (!user) {
      const existingByEmail = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (existingByEmail) {
        db.prepare('UPDATE users SET github_id = ?, github_token = ? WHERE id = ?')
          .run(githubId, access_token, existingByEmail.id);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(existingByEmail.id);
      } else {
        const result = db.prepare(
          'INSERT INTO users (email, github_id, role, organization_id, is_active, two_factor_secret, github_token, name) VALUES (?, ?, ?, ?, 1, ?, ?, ?)'
        ).run(email, githubId, 'developer', 1, secret.base32, access_token, name);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
      }
    } else {
      db.prepare('UPDATE users SET github_token = ? WHERE id = ?').run(access_token, user.id);
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, organization_id: user.organization_id },
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
        name: user.name
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

    let user = db.prepare('SELECT * FROM users WHERE github_id = ?').get(githubId);
    const secret = speakeasy.generateSecret({ name: `Aikya (${email})` });

    if (!user) {
      const existingByEmail = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (existingByEmail) {
        db.prepare('UPDATE users SET github_id = ?, github_token = ? WHERE id = ?')
          .run(githubId, access_token, existingByEmail.id);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(existingByEmail.id);
      } else {
        const result = db.prepare(
          'INSERT INTO users (email, github_id, role, organization_id, is_active, two_factor_secret, github_token, name) VALUES (?, ?, ?, ?, 1, ?, ?, ?)'
        ).run(email, githubId, 'developer', 1, secret.base32, access_token, name);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
      }
    } else {
      db.prepare('UPDATE users SET github_token = ? WHERE id = ?').run(access_token, user.id);
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, organization_id: user.organization_id },
      getJwtSecret(),
      { expiresIn: '24h' }
    );

    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (error) {
    console.error('GitHub OAuth error:', error.response?.data || error);
    res.status(500).json({ error: 'Failed to authenticate with GitHub' });
  }
});

// Disconnect GitHub
router.post('/github/disconnect', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Remove GitHub token
    db.prepare('UPDATE users SET github_token = NULL WHERE id = ?').run(userId);

    // Log audit action
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
    console.log('Password reset request received for:', req.body.email);
    
    const { email } = req.body;
    if (!email) {
      console.log('No email provided in request');
      return res.status(400).json({ error: 'Email required' });
    }
    
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      console.log('User not found for email:', email);
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log('User found, generating OTP for:', email);
    const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min
    
    // Update user with OTP
    db.prepare('UPDATE users SET reset_otp = ?, otp_expiry = ? WHERE id = ?').run(otp, expiry, user.id);
    console.log('OTP generated and stored for user:', email, 'OTP:', otp);
    
    // Send OTP email
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
      
      console.log('Email sending result:', emailResult);
      
      if (emailResult.devMode) {
        // In development mode, return success with OTP in response
        res.json({ 
          message: 'OTP sent to email (dev mode)',
          devOtp: otp,
          devMode: true
        });
      } else {
        res.json({ message: 'OTP sent to email' });
      }
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      
      if (emailError.message === 'Email service not configured') {
        // In production, this should be an error, but in dev we can still proceed
        if (NODE_ENV === 'development') {
          return res.json({ 
            message: 'OTP generated (email not configured)',
            devOtp: otp,
            devMode: true,
            warning: 'Email service not configured'
          });
        } else {
          return res.status(500).json({ 
            error: 'Email service not configured. Please contact administrator.',
            details: 'Email credentials are missing from environment variables.'
          });
        }
      }
      
      res.status(500).json({ 
        error: 'Failed to send email. Please try again later.',
        details: emailError.message 
      });
    }
  } catch (error) {
    console.error('Unexpected error in request-password-reset:', error);
    res.status(500).json({ 
      error: 'An unexpected error occurred. Please try again.',
      details: error.message 
    });
  }
});

// Verify OTP
router.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !user.reset_otp || !user.otp_expiry) return res.status(400).json({ error: 'No OTP set' });
  if (user.reset_otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });
  if (new Date() > new Date(user.otp_expiry)) return res.status(400).json({ error: 'OTP expired' });
  res.json({ message: 'OTP verified' });
});

// Reset password
router.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) return res.status(400).json({ error: 'All fields required' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !user.reset_otp || !user.otp_expiry) return res.status(400).json({ error: 'No OTP set' });
  if (user.reset_otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });
  if (new Date() > new Date(user.otp_expiry)) return res.status(400).json({ error: 'OTP expired' });
  const passwordHash = await bcrypt.hash(newPassword, 12);
  db.prepare('UPDATE users SET password_hash = ?, reset_otp = NULL, otp_expiry = NULL WHERE id = ?').run(passwordHash, user.id);
  res.json({ message: 'Password reset successful' });
});

// 2FA Setup (generate secret and QR)
router.post('/enable-2fa', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const secret = speakeasy.generateSecret({ name: `DevOpsAI (${email})` });
  db.prepare('UPDATE users SET two_factor_secret = ? WHERE id = ?').run(secret.base32, user.id);
  const otpauth = secret.otpauth_url;
  const qr = await qrcode.toDataURL(otpauth);
  res.json({ qr, secret: secret.base32 });
});

// 2FA Verify (during setup or login)
router.post('/verify-2fa', (req, res) => {
  const { email, token } = req.body;
  if (!email || !token) return res.status(400).json({ error: 'Email and token required' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !user.two_factor_secret) return res.status(400).json({ error: '2FA not set up' });
  const verified = speakeasy.totp.verify({
    secret: user.two_factor_secret,
    encoding: 'base32',
    token,
    window: 1
  });
  if (!verified) return res.status(400).json({ error: 'Invalid 2FA code' });
  // If verifying for setup, enable 2FA
  if (!user.two_factor_enabled) {
    db.prepare('UPDATE users SET two_factor_enabled = 1 WHERE id = ?').run(user.id);
  }
  res.json({ message: '2FA verified' });
});

export default router;
