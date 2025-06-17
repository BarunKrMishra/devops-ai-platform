import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcrypt';

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
        two_factor_enabled BOOLEAN DEFAULT 0,
        two_factor_secret TEXT,
        last_login DATETIME,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        github_token TEXT,
        FOREIGN KEY (organization_id) REFERENCES organizations(id)
      )
    `);

    // Create demo account if it doesn't exist
    const demoUser = db.prepare('SELECT id FROM users WHERE email = ?').get('demo@devopsai.com');
    if (!demoUser) {
      const passwordHash = await bcrypt.hash('demo123!@#', 10);
      db.prepare(
        'INSERT INTO users (email, password_hash, name, role, organization_id, permissions) VALUES (?, ?, ?, ?, ?, ?)'
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
        })
      );
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
      db.prepare('INSERT INTO users (email, password_hash, name, role, organization_id, is_active) VALUES (?, ?, ?, ?, ?, 1)')
        .run('admin', passwordHash, 'Admin', 'admin', defaultOrgId);
      console.log('Default admin user created: admin/admin');
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
};

export { db };