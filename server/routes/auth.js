import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../database/init.js';
import axios from 'axios';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Allowed roles for registration
const ALLOWED_ROLES = ['developer', 'manager', 'user'];

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, role = 'developer' } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
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
    const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12); // Increased from 10 to 12 rounds

    // Default organization ID is 1
    const result = db.prepare(
      'INSERT INTO users (email, password_hash, role, organization_id) VALUES (?, ?, ?, ?)'
    ).run(email, passwordHash, role, 1);

    const user = {
      id: result.lastInsertRowid,
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

    // Update last login
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    res.json({ token, user });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: NODE_ENV === 'development' ? error.message : 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
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

    // Update last login
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

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
      const result = db.prepare(
        'INSERT INTO users (email, github_id, role, organization_id) VALUES (?, ?, ?, ?)'
      ).run(mockGitHubUser.email, mockGitHubUser.id, 'developer', 1);

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
      const stmt = db.prepare(
        'INSERT INTO users (email, password, role, github_token) VALUES (?, ?, ?, ?)'
      );
      const info = stmt.run(email, '', 'user', access_token);
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

export default router;