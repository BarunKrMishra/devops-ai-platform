import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, '../../devops_ai.db'));

export const initDatabase = async () => {
  try {
    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Organizations table (for multi-tenancy)
    db.exec(`
      CREATE TABLE IF NOT EXISTS organizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        plan TEXT DEFAULT 'free',
        billing_email TEXT,
        settings TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create default organization if it doesn't exist
    const defaultOrg = db.prepare('SELECT id FROM organizations WHERE id = 1').get();
    if (!defaultOrg) {
      db.prepare(
        'INSERT INTO organizations (id, name, slug, plan) VALUES (?, ?, ?, ?)'
      ).run(1, 'Demo Organization', 'demo-org', 'enterprise');
    }

    // Users table with enhanced roles and organization support
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        github_id TEXT,
        gitlab_id TEXT,
        name TEXT,
        role TEXT DEFAULT 'developer',
        organization_id INTEGER DEFAULT 1,
        permissions TEXT DEFAULT '{}',
        two_factor_enabled BOOLEAN DEFAULT 1,
        two_factor_secret TEXT NOT NULL,
        two_factor_method TEXT DEFAULT 'totp',
        reset_otp TEXT,
        otp_expiry DATETIME,
        last_login DATETIME,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        github_token TEXT,
        FOREIGN KEY (organization_id) REFERENCES organizations(id)
      )
    `);

    // Create demo account if it doesn't exist
    const demoUser = db.prepare('SELECT id, two_factor_secret FROM users WHERE email = ?').get('demo@devopsai.com');
    if (!demoUser) {
      const passwordHash = await bcrypt.hash('demo123!@#', 10);
      const secret = speakeasy.generateSecret({ name: 'DevOpsAI (demo@devopsai.com)' });
      db.prepare(
        'INSERT INTO users (email, password_hash, name, role, organization_id, permissions, two_factor_secret) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(
        'demo@devopsai.com',
        passwordHash,
        'Demo User',
        'manager',
        1,
        JSON.stringify({
          canManageUsers: true,
          canManageProjects: true,
          canManageTemplates: true,
          canViewAnalytics: true
        }),
        secret.base32
      );
      console.log('Demo user created: demo@devopsai.com / demo123!@#');
    } else if (!demoUser.two_factor_secret) {
      // If demo user exists but is missing a secret, add one
      const secret = speakeasy.generateSecret({ name: 'DevOpsAI (demo@devopsai.com)' });
      db.prepare('UPDATE users SET two_factor_secret = ? WHERE email = ?').run(secret.base32, 'demo@devopsai.com');
      console.log('Updated demo user with two_factor_secret');
    }

    // Migration: Ensure all users have two_factor_secret
    const usersWithoutSecret = db.prepare("SELECT id, email FROM users WHERE two_factor_secret IS NULL OR two_factor_secret = ''").all();
    for (const user of usersWithoutSecret) {
      const secret = speakeasy.generateSecret({ name: `DevOpsAI (${user.email})` });
      db.prepare('UPDATE users SET two_factor_secret = ? WHERE id = ?').run(secret.base32, user.id);
      console.log(`Updated user ${user.email} with two_factor_secret`);
    }

    // --- MIGRATION: Ensure all required columns exist in users table ---
    const columns = db.prepare("PRAGMA table_info(users)").all();
    const hasTwoFactorSecret = columns.some(col => col.name === 'two_factor_secret');
    if (!hasTwoFactorSecret) {
      db.exec('ALTER TABLE users ADD COLUMN two_factor_secret TEXT');
    }
    // Populate two_factor_secret for all users if missing or empty
    const usersMissingSecret = db.prepare("SELECT id, email FROM users WHERE two_factor_secret IS NULL OR two_factor_secret = ''").all();
    for (const user of usersMissingSecret) {
      const secret = speakeasy.generateSecret({ name: `DevOpsAI (${user.email})` });
      db.prepare('UPDATE users SET two_factor_secret = ? WHERE id = ?').run(secret.base32, user.id);
    }
    // --- END MIGRATION ---

    // Database migrations for existing tables
    try {
      // Check if two_factor_method column exists
      const columns = db.prepare("PRAGMA table_info(users)").all();
      const hasTwoFactorMethod = columns.some(col => col.name === 'two_factor_method');
      
      if (!hasTwoFactorMethod) {
        console.log('Adding two_factor_method column to users table...');
        db.exec('ALTER TABLE users ADD COLUMN two_factor_method TEXT DEFAULT "totp"');
      }
      
      // Check if other missing columns exist and add them
      const hasTwoFactorEnabled = columns.some(col => col.name === 'two_factor_enabled');
      if (!hasTwoFactorEnabled) {
        console.log('Adding two_factor_enabled column to users table...');
        db.exec('ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT 1');
      }
      
      const hasResetOtp = columns.some(col => col.name === 'reset_otp');
      if (!hasResetOtp) {
        console.log('Adding reset_otp column to users table...');
        db.exec('ALTER TABLE users ADD COLUMN reset_otp TEXT');
      }
      
      const hasOtpExpiry = columns.some(col => col.name === 'otp_expiry');
      if (!hasOtpExpiry) {
        console.log('Adding otp_expiry column to users table...');
        db.exec('ALTER TABLE users ADD COLUMN otp_expiry DATETIME');
      }
      
      const hasLastLogin = columns.some(col => col.name === 'last_login');
      if (!hasLastLogin) {
        console.log('Adding last_login column to users table...');
        db.exec('ALTER TABLE users ADD COLUMN last_login DATETIME');
      }
      
      const hasIsActive = columns.some(col => col.name === 'is_active');
      if (!hasIsActive) {
        console.log('Adding is_active column to users table...');
        db.exec('ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1');
      }
      
      const hasGithubToken = columns.some(col => col.name === 'github_token');
      if (!hasGithubToken) {
        console.log('Adding github_token column to users table...');
        db.exec('ALTER TABLE users ADD COLUMN github_token TEXT');
      }
      
      console.log('Database migrations completed successfully');
    } catch (error) {
      console.error('Migration error:', error);
    }

    // Final migration: Ensure ALL users have two_factor_secret
    try {
      const allUsers = db.prepare('SELECT id, email FROM users').all();
      for (const user of allUsers) {
        const existingSecret = db.prepare('SELECT two_factor_secret FROM users WHERE id = ?').get(user.id);
        if (!existingSecret.two_factor_secret || existingSecret.two_factor_secret === '') {
          const secret = speakeasy.generateSecret({ name: `DevOpsAI (${user.email})` });
          db.prepare('UPDATE users SET two_factor_secret = ? WHERE id = ?').run(secret.base32, user.id);
          console.log(`Ensured user ${user.email} has two_factor_secret`);
        }
      }
      console.log('Final migration: All users now have two_factor_secret');
    } catch (error) {
      console.error('Final migration error:', error);
    }

    // Templates table for deployment blueprints
    db.exec(`
      CREATE TABLE IF NOT EXISTS templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT,
        template_data TEXT NOT NULL,
        is_public BOOLEAN DEFAULT 0,
        created_by INTEGER,
        organization_id INTEGER,
        tags TEXT DEFAULT '[]',
        version TEXT DEFAULT '1.0.0',
        downloads INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (organization_id) REFERENCES organizations(id)
      )
    `);

    // Projects table with enhanced features
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        organization_id INTEGER,
        name TEXT NOT NULL,
        description TEXT,
        repository_url TEXT,
        branch TEXT DEFAULT 'main',
        framework TEXT,
        cloud_provider TEXT,
        status TEXT DEFAULT 'active',
        template_id INTEGER,
        environment_variables TEXT DEFAULT '{}',
        collaborators TEXT DEFAULT '[]',
        settings TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (template_id) REFERENCES templates(id)
      )
    `);

    // Deployments table
    db.exec(`
      CREATE TABLE IF NOT EXISTS deployments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        commit_hash TEXT,
        status TEXT,
        environment TEXT,
        duration INTEGER,
        logs TEXT,
        deployed_by INTEGER,
        rollback_target INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (deployed_by) REFERENCES users(id),
        FOREIGN KEY (rollback_target) REFERENCES deployments(id)
      )
    `);

    // Infrastructure resources table
    db.exec(`
      CREATE TABLE IF NOT EXISTS infrastructure_resources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        resource_type TEXT,
        resource_id TEXT,
        region TEXT,
        status TEXT,
        configuration TEXT,
        cost_per_hour REAL,
        backup_enabled BOOLEAN DEFAULT 0,
        backup_schedule TEXT,
        last_backup DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      )
    `);

    // Notifications table
    db.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        organization_id INTEGER,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        data TEXT DEFAULT '{}',
        read BOOLEAN DEFAULT 0,
        priority TEXT DEFAULT 'normal',
        expires_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (organization_id) REFERENCES organizations(id)
      )
    `);

    // Alert rules table
    db.exec(`
      CREATE TABLE IF NOT EXISTS alert_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        name TEXT NOT NULL,
        condition_type TEXT NOT NULL,
        threshold_value REAL,
        comparison_operator TEXT,
        duration_minutes INTEGER DEFAULT 5,
        escalation_chain TEXT DEFAULT '[]',
        notification_channels TEXT DEFAULT '[]',
        is_active BOOLEAN DEFAULT 1,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    // Incidents table
    db.exec(`
      CREATE TABLE IF NOT EXISTS incidents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        alert_rule_id INTEGER,
        title TEXT NOT NULL,
        description TEXT,
        severity TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'open',
        assigned_to INTEGER,
        resolved_at DATETIME,
        resolution_notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (alert_rule_id) REFERENCES alert_rules(id),
        FOREIGN KEY (assigned_to) REFERENCES users(id)
      )
    `);

    // Audit logs table with enhanced tracking
    db.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        organization_id INTEGER,
        action TEXT,
        resource_type TEXT,
        resource_id TEXT,
        details TEXT,
        ip_address TEXT,
        user_agent TEXT,
        session_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (organization_id) REFERENCES organizations(id)
      )
    `);

    // AI interactions table
    db.exec(`
      CREATE TABLE IF NOT EXISTS ai_interactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        organization_id INTEGER,
        command TEXT,
        response TEXT,
        action_taken TEXT,
        success BOOLEAN,
        feedback_rating INTEGER,
        feedback_comment TEXT,
        model_version TEXT,
        confidence_score REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (organization_id) REFERENCES organizations(id)
      )
    `);

    // Integrations table
    db.exec(`
      CREATE TABLE IF NOT EXISTS integrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        configuration TEXT NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        last_sync DATETIME,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    // Webhooks table
    db.exec(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER,
        project_id INTEGER,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        events TEXT DEFAULT '[]',
        secret TEXT,
        is_active BOOLEAN DEFAULT 1,
        last_triggered DATETIME,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    // Backups table
    db.exec(`
      CREATE TABLE IF NOT EXISTS backups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        resource_id INTEGER,
        backup_type TEXT NOT NULL,
        backup_location TEXT NOT NULL,
        size_bytes INTEGER,
        status TEXT DEFAULT 'completed',
        retention_days INTEGER DEFAULT 30,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (resource_id) REFERENCES infrastructure_resources(id)
      )
    `);

    // Usage metrics table for billing
    db.exec(`
      CREATE TABLE IF NOT EXISTS usage_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER,
        metric_type TEXT NOT NULL,
        value REAL NOT NULL,
        unit TEXT NOT NULL,
        recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id)
      )
    `);

    // Login attempts table
    db.exec(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT,
        success BOOLEAN,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT
      )
    `);

    // Create default organization if it doesn't exist
    const existingOrg = db.prepare('SELECT id FROM organizations WHERE slug = ?').get('default');
    let defaultOrgId;
    if (!existingOrg) {
      const info = db.prepare(`
        INSERT INTO organizations (name, slug, plan) 
        VALUES (?, ?, ?)
      `).run('Default Organization', 'default', 'enterprise');
      defaultOrgId = info.lastInsertRowid;
    } else {
      defaultOrgId = existingOrg.id;
    }

    // Create default admin user if not exists
    const adminUser = db.prepare('SELECT * FROM users WHERE email = ?').get('admin');
    if (!adminUser) {
      const passwordHash = bcrypt.hashSync('admin', 10);
      const secret = speakeasy.generateSecret({ name: 'DevOpsAI (admin)' });
      db.prepare('INSERT INTO users (email, password_hash, name, role, organization_id, is_active, two_factor_secret) VALUES (?, ?, ?, ?, ?, 1, ?)')
        .run('admin', passwordHash, 'Admin', 'admin', defaultOrgId, secret.base32);
      console.log('Default admin user created: admin/admin');
    } else if (!adminUser.two_factor_secret) {
      // If admin user exists but is missing a secret, add one
      const secret = speakeasy.generateSecret({ name: 'DevOpsAI (admin)' });
      db.prepare('UPDATE users SET two_factor_secret = ? WHERE email = ?').run(secret.base32, 'admin');
      console.log('Updated admin user with two_factor_secret');
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
};

export { db };