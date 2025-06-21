import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../database/init.js';
import axios from 'axios';
import { authenticateToken } from '../middleware/auth.js';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import fs from 'fs';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Allowed roles for registration
const ALLOWED_ROLES = ['developer', 'manager', 'user'];

// Email transporter setup (use environment variables in production)
let transporter = null;

// Check if email credentials are available
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
  
  // Verify transporter configuration
  transporter.verify(function(error, success) {
    if (error) {
      console.error('Email transporter verification failed:', error);
      transporter = null;
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
  
  try {
    const result = await transporter.sendMail(emailOptions);
    console.log('Email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
}

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
        'INSERT INTO users (email, password_hash, role, organization_id, two_factor_enabled, two_factor_secret, two_factor_method, is_active) VALUES (?, ?, ?, ?, 1, ?, ?, 0)' // is_active = 0 for pending verification
      ).run(email, passwordHash, role, 1, secret ? secret.base32 : null, twoFactorMethod);

      const tempUserId = result.lastInsertRowid;

      // Generate OTP and send email
      const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
      const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min
      db.prepare('UPDATE users SET reset_otp = ?, otp_expiry = ? WHERE id = ?').run(otp, expiry, tempUserId);
      console.log(`Generated registration OTP for ${email}: ${otp}`); // Log OTP for debugging
      
      try {
        await sendEmailWithFallback({
          from: process.env.EMAIL_USER,
          to: email,
          subject: 'Complete Your Registration - OTP Required',
          text: `Your registration OTP is: ${otp}. It expires in 10 minutes. Please enter this code to complete your account setup.`
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

    // Log user contact for sales
    logUserContact(email, 'register');

    const user = {
      id: tempUser.id,
      email,
      role,
      organization_id: 1
    };

    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role, 
        organization_id: user.organization_id 
      },
      JWT_SECRET,
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
        await sendEmailWithFallback({
          from: process.env.EMAIL_USER,
          to: email,
          subject: 'Your Login OTP',
          text: `Your OTP is: ${otp}. It expires in 10 minutes.`
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
      JWT_SECRET,
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
    const { code } = req.body;

    // In a real implementation, exchange code for access token with GitHub
    // For demo purposes, we'll simulate this
    const mockGitHubUser = {
      id: '12345',
      email: 'user@github.com',
      login: 'githubuser'
    };

    // Check if user exists
    let user = db.prepare('SELECT * FROM users WHERE github_id = ?').get(mockGitHubUser.id);

    if (!user) {
      // Create new user with developer role
      const secret = speakeasy.generateSecret({ name: `DevOpsAI (${mockGitHubUser.email})` });
      const result = db.prepare(
        'INSERT INTO users (email, github_id, role, organization_id, two_factor_secret) VALUES (?, ?, ?, ?, ?)'
      ).run(mockGitHubUser.email, mockGitHubUser.id, 'developer', 1, secret.base32);

      user = {
        id: result.lastInsertRowid,
        email: mockGitHubUser.email,
        github_id: mockGitHubUser.id,
        role: 'developer',
        organization_id: 1
      };
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, organization_id: user.organization_id },
      JWT_SECRET
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        organization_id: user.organization_id
      }
    });
  } catch (error) {
    console.error('GitHub OAuth error:', error);
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

    // Exchange code for access token
    const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code
    }, {
      headers: {
        Accept: 'application/json'
      }
    });

    const { access_token } = tokenResponse.data;

    // Get user info from GitHub
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `token ${access_token}`
      }
    });

    const { email } = userResponse.data;

    // Find or create user
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    
    if (!user) {
      // Create new user
      const secret = speakeasy.generateSecret({ name: `DevOpsAI (${email})` });
      const stmt = db.prepare(
        'INSERT INTO users (email, password_hash, role, github_token, two_factor_secret) VALUES (?, ?, ?, ?, ?)'
      );
      const info = stmt.run(email, '', 'user', access_token, secret.base32);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    } else {
      // Update existing user's GitHub token
      db.prepare('UPDATE users SET github_token = ? WHERE id = ?').run(access_token, user.id);
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Update last login
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    // Log audit action
    await logAuditAction(user.id, 'GITHUB_CONNECT', 'user', user.id, {
      method: 'oauth'
    });

    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (error) {
    console.error('GitHub OAuth error:', error);
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
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
  const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min
  db.prepare('UPDATE users SET reset_otp = ?, otp_expiry = ? WHERE id = ?').run(otp, expiry, user.id);
  // Send OTP email
  try {
    await sendEmailWithFallback({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your Password Reset OTP',
      text: `Your OTP is: ${otp}. It expires in 10 minutes.`
    });
    res.json({ message: 'OTP sent to email' });
  } catch (e) {
    console.error('Email sending error:', e);
    
    if (e.message === 'Email service not configured') {
      return res.status(500).json({ 
        error: 'Email service not configured. Please contact administrator.',
        details: 'Email credentials are missing from environment variables.'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to send email. Please try again later.',
      details: e.message 
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