import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const defaultDbPath = join(__dirname, '../../devops_ai.db');
const dbPath = process.env.DATABASE_PATH
  ? resolve(process.env.DATABASE_PATH)
  : defaultDbPath;

const db = new Database(dbPath);

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
        seat_limit INTEGER DEFAULT 10,
        settings TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migration: ensure seat_limit exists on organizations
    try {
      const orgColumns = db.prepare('PRAGMA table_info(organizations)').all();
      if (!orgColumns.some(col => col.name === 'seat_limit')) {
        db.exec('ALTER TABLE organizations ADD COLUMN seat_limit INTEGER DEFAULT 10');
      }
    } catch (error) {
      console.error('Organization migration error:', error);
    }

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

    // Onboarding profiles (scalable for future segmentation)
    db.exec(`
      CREATE TABLE IF NOT EXISTS onboarding_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL UNIQUE,
        user_id INTEGER NOT NULL,
        account_type TEXT NOT NULL,
        organization_name TEXT,
        company_domain TEXT,
        team_size TEXT,
        role TEXT,
        use_cases TEXT DEFAULT '[]',
        clouds TEXT DEFAULT '[]',
        security_requirements TEXT DEFAULT '[]',
        security_contact_email TEXT,
        ai_integration BOOLEAN DEFAULT 0,
        ai_provider TEXT,
        ai_integration_method TEXT,
        ai_integration_notes TEXT,
        consent_terms BOOLEAN DEFAULT 0,
        consent_privacy BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Migration: add AI integration columns if missing
    try {
      const onboardingColumns = db.prepare('PRAGMA table_info(onboarding_profiles)').all();
      const ensureColumn = (name, definition) => {
        if (!onboardingColumns.some(col => col.name === name)) {
          db.exec(`ALTER TABLE onboarding_profiles ADD COLUMN ${definition}`);
        }
      };
      ensureColumn('ai_integration', 'ai_integration BOOLEAN DEFAULT 0');
      ensureColumn('ai_provider', 'ai_provider TEXT');
      ensureColumn('ai_integration_method', 'ai_integration_method TEXT');
      ensureColumn('ai_integration_notes', 'ai_integration_notes TEXT');
    } catch (error) {
      console.error('Onboarding migration error:', error);
    }

    // Organization settings
    db.exec(`
      CREATE TABLE IF NOT EXISTS organization_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL UNIQUE,
        demo_mode BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id)
      )
    `);

    // User settings (preferences, notifications)
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id INTEGER PRIMARY KEY,
        notifications TEXT DEFAULT '{}',
        experience TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Personal API keys (optional)
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT,
        key_hash TEXT NOT NULL,
        last_four TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Teams table (org-scoped)
    db.exec(`
      CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (organization_id, name),
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    // Team members table
    db.exec(`
      CREATE TABLE IF NOT EXISTS team_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT DEFAULT 'member',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (team_id, user_id),
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Organization invites table
    db.exec(`
      CREATE TABLE IF NOT EXISTS organization_invites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        email TEXT NOT NULL,
        role TEXT DEFAULT 'developer',
        team_ids TEXT DEFAULT '[]',
        token TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        invited_by INTEGER,
        expires_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        accepted_at DATETIME,
        UNIQUE (organization_id, email),
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (invited_by) REFERENCES users(id)
      )
    `);

    // Go-live requests (per organization)
    db.exec(`
      CREATE TABLE IF NOT EXISTS go_live_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        selected_features TEXT DEFAULT '[]',
        requirements_notes TEXT,
        contact_email TEXT,
        ai_integration BOOLEAN DEFAULT 0,
        ai_provider TEXT,
        ai_integration_method TEXT,
        ai_integration_notes TEXT,
        data_sources TEXT DEFAULT '[]',
        live_data_notes TEXT,
        integration_details TEXT DEFAULT '{}',
        status TEXT DEFAULT 'new',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    try {
      const goLiveColumns = db.prepare('PRAGMA table_info(go_live_requests)').all();
      const ensureColumn = (name, definition) => {
        if (!goLiveColumns.some(col => col.name === name)) {
          db.exec(`ALTER TABLE go_live_requests ADD COLUMN ${definition}`);
        }
      };
      ensureColumn('data_sources', "data_sources TEXT DEFAULT '[]'");
      ensureColumn('live_data_notes', 'live_data_notes TEXT');
      ensureColumn('integration_details', "integration_details TEXT DEFAULT '{}'");
    } catch (error) {
      console.error('Go-live migration error:', error);
    }

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
        started_at DATETIME,
        completed_at DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (deployed_by) REFERENCES users(id),
        FOREIGN KEY (rollback_target) REFERENCES deployments(id)
      )
    `);

    try {
      const deploymentColumns = db.prepare('PRAGMA table_info(deployments)').all();
      const ensureColumn = (name, definition) => {
        if (!deploymentColumns.some(col => col.name === name)) {
          db.exec(`ALTER TABLE deployments ADD COLUMN ${definition}`);
        }
      };
      ensureColumn('started_at', 'started_at DATETIME');
      ensureColumn('completed_at', 'completed_at DATETIME');
      ensureColumn('updated_at', 'updated_at DATETIME');
      db.exec(`UPDATE deployments SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)`);
    } catch (error) {
      console.error('Deployments migration error:', error);
    }

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

    try {
      db.exec(`
        UPDATE audit_logs
        SET organization_id = (
          SELECT organization_id FROM users WHERE users.id = audit_logs.user_id
        )
        WHERE organization_id IS NULL
      `);
    } catch (error) {
      console.error('Audit logs migration error:', error);
    }

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
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    try {
      const integrationColumns = db.prepare('PRAGMA table_info(integrations)').all();
      const ensureColumn = (name, definition) => {
        if (!integrationColumns.some(col => col.name === name)) {
          db.exec(`ALTER TABLE integrations ADD COLUMN ${definition}`);
        }
      };
      ensureColumn('updated_at', 'updated_at DATETIME');
      db.exec(`UPDATE integrations SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)`);
    } catch (error) {
      console.error('Integrations migration error:', error);
    }

    // Integration secrets (encrypted per organization)
    db.exec(`
      CREATE TABLE IF NOT EXISTS integration_secrets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        integration_id INTEGER NOT NULL UNIQUE,
        encrypted_payload TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (integration_id) REFERENCES integrations(id)
      )
    `);

    try {
      const secretColumns = db.prepare('PRAGMA table_info(integration_secrets)').all();
      const ensureColumn = (name, definition) => {
        if (!secretColumns.some(col => col.name === name)) {
          db.exec(`ALTER TABLE integration_secrets ADD COLUMN ${definition}`);
        }
      };
      ensureColumn('encrypted_payload', 'encrypted_payload TEXT NOT NULL');
    } catch (error) {
      console.error('Integration secrets migration error:', error);
    }

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
