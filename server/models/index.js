import { DataTypes } from 'sequelize';
import { sequelize } from '../database/sequelize.js';

const baseOptions = {
  timestamps: true,
  underscored: true
};

export const Organization = sequelize.define('Organization', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  slug: { type: DataTypes.STRING, allowNull: false, unique: true },
  plan: { type: DataTypes.STRING, allowNull: false, defaultValue: 'free' },
  billing_email: { type: DataTypes.STRING },
  seat_limit: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 10 },
  settings: { type: DataTypes.JSON }
}, { ...baseOptions, tableName: 'organizations' });

export const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password_hash: { type: DataTypes.STRING },
  github_id: { type: DataTypes.STRING },
  gitlab_id: { type: DataTypes.STRING },
  name: { type: DataTypes.STRING },
  role: { type: DataTypes.STRING, defaultValue: 'developer' },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  permissions: { type: DataTypes.JSON },
  two_factor_enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  two_factor_secret: { type: DataTypes.STRING },
  two_factor_method: { type: DataTypes.STRING, defaultValue: 'totp' },
  reset_otp: { type: DataTypes.STRING },
  otp_expiry: { type: DataTypes.DATE },
  last_login: { type: DataTypes.DATE },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  github_token: { type: DataTypes.TEXT }
}, { ...baseOptions, tableName: 'users' });

export const OnboardingProfile = sequelize.define('OnboardingProfile', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
  user_id: { type: DataTypes.INTEGER.UNSIGNED },
  account_type: { type: DataTypes.STRING },
  organization_name: { type: DataTypes.STRING },
  company_domain: { type: DataTypes.STRING },
  team_size: { type: DataTypes.STRING },
  role: { type: DataTypes.STRING },
  use_cases: { type: DataTypes.JSON },
  clouds: { type: DataTypes.JSON },
  security_requirements: { type: DataTypes.JSON },
  security_contact_email: { type: DataTypes.STRING },
  ai_integration: { type: DataTypes.BOOLEAN, defaultValue: false },
  ai_provider: { type: DataTypes.STRING },
  ai_integration_method: { type: DataTypes.STRING },
  ai_integration_notes: { type: DataTypes.TEXT },
  consent_terms: { type: DataTypes.BOOLEAN, defaultValue: false },
  consent_privacy: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { ...baseOptions, tableName: 'onboarding_profiles' });

export const OnboardingSetting = sequelize.define('OnboardingSetting', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
  demo_mode: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { ...baseOptions, tableName: 'organization_settings' });

export const GoLiveRequest = sequelize.define('GoLiveRequest', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  requester_id: { type: DataTypes.INTEGER.UNSIGNED },
  requirements_notes: { type: DataTypes.TEXT },
  contact_email: { type: DataTypes.STRING },
  ai_integration: { type: DataTypes.BOOLEAN, defaultValue: false },
  ai_provider: { type: DataTypes.STRING },
  ai_integration_method: { type: DataTypes.STRING },
  ai_integration_notes: { type: DataTypes.TEXT },
  selected_features: { type: DataTypes.JSON },
  data_sources: { type: DataTypes.JSON },
  live_data_notes: { type: DataTypes.TEXT },
  integration_details: { type: DataTypes.JSON },
  status: { type: DataTypes.STRING, defaultValue: 'pending' }
}, { ...baseOptions, tableName: 'go_live_requests' });

export const OrganizationInvite = sequelize.define('OrganizationInvite', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.STRING, defaultValue: 'developer' },
  team_ids: { type: DataTypes.JSON },
  token: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING, defaultValue: 'pending' },
  invited_by: { type: DataTypes.INTEGER.UNSIGNED },
  expires_at: { type: DataTypes.DATE },
  accepted_at: { type: DataTypes.DATE }
}, { ...baseOptions, tableName: 'organization_invites' });

export const Team = sequelize.define('Team', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  created_by: { type: DataTypes.INTEGER.UNSIGNED }
}, { ...baseOptions, tableName: 'teams' });

export const TeamMember = sequelize.define('TeamMember', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  team_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED },
  role: { type: DataTypes.STRING, defaultValue: 'member' }
}, { ...baseOptions, tableName: 'team_members' });

export const OpsModule = sequelize.define('OpsModule', {
  key: { type: DataTypes.STRING, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  category: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  ai_enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  metadata: { type: DataTypes.JSON }
}, { ...baseOptions, tableName: 'ops_modules' });

export const OrganizationOps = sequelize.define('OrganizationOps', {
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true },
  module_key: { type: DataTypes.STRING, primaryKey: true },
  enabled: { type: DataTypes.BOOLEAN, defaultValue: false },
  configured: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { ...baseOptions, tableName: 'organization_ops' });

export const OpsPurchaseRequest = sequelize.define('OpsPurchaseRequest', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  module_key: { type: DataTypes.STRING, allowNull: false },
  requested_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  status: { type: DataTypes.STRING, defaultValue: 'pending' },
  notes: { type: DataTypes.TEXT }
}, { ...baseOptions, tableName: 'ops_purchase_requests' });

export const Template = sequelize.define('Template', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  category: { type: DataTypes.STRING },
  template_data: { type: DataTypes.JSON },
  tags: { type: DataTypes.JSON },
  downloads: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  is_public: { type: DataTypes.BOOLEAN, defaultValue: false },
  version: { type: DataTypes.STRING, defaultValue: '1.0.0' },
  created_by: { type: DataTypes.INTEGER.UNSIGNED }
}, { ...baseOptions, tableName: 'templates' });

export const Integration = sequelize.define('Integration', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  type: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  configuration: { type: DataTypes.JSON },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  last_sync: { type: DataTypes.DATE },
  created_by: { type: DataTypes.INTEGER.UNSIGNED }
}, { ...baseOptions, tableName: 'integrations' });

export const IntegrationSecret = sequelize.define('IntegrationSecret', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  integration_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  encrypted_payload: { type: DataTypes.JSON, allowNull: false }
}, { ...baseOptions, tableName: 'integration_secrets' });

export const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  user_id: { type: DataTypes.INTEGER.UNSIGNED },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED },
  action: { type: DataTypes.STRING, allowNull: false },
  resource_type: { type: DataTypes.STRING },
  resource_id: { type: DataTypes.STRING },
  details: { type: DataTypes.JSON },
  ip_address: { type: DataTypes.STRING },
  user_agent: { type: DataTypes.TEXT },
  session_id: { type: DataTypes.STRING }
}, { ...baseOptions, tableName: 'audit_logs' });

export const UserSetting = sequelize.define('UserSetting', {
  user_id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true },
  notifications: { type: DataTypes.JSON },
  experience: { type: DataTypes.JSON }
}, { ...baseOptions, tableName: 'user_settings' });

export const UserApiKey = sequelize.define('UserApiKey', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  name: { type: DataTypes.STRING },
  key_hash: { type: DataTypes.STRING, allowNull: false },
  last_four: { type: DataTypes.STRING },
  last_used: { type: DataTypes.DATE },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { ...baseOptions, tableName: 'user_api_keys' });

export const LoginAttempt = sequelize.define('LoginAttempt', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  email: { type: DataTypes.STRING },
  success: { type: DataTypes.BOOLEAN },
  timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  ip_address: { type: DataTypes.STRING }
}, { ...baseOptions, tableName: 'login_attempts' });

export const UsageMetric = sequelize.define('UsageMetric', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  metric_type: { type: DataTypes.STRING, allowNull: false },
  value: { type: DataTypes.FLOAT, allowNull: false },
  unit: { type: DataTypes.STRING, allowNull: false },
  recorded_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { ...baseOptions, tableName: 'usage_metrics' });

export const Project = sequelize.define('Project', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  repository_url: { type: DataTypes.STRING },
  branch: { type: DataTypes.STRING, defaultValue: 'main' },
  framework: { type: DataTypes.STRING },
  cloud_provider: { type: DataTypes.STRING },
  status: { type: DataTypes.STRING, defaultValue: 'active' },
  template_id: { type: DataTypes.INTEGER.UNSIGNED },
  environment_variables: { type: DataTypes.JSON },
  collaborators: { type: DataTypes.JSON },
  settings: { type: DataTypes.JSON }
}, { ...baseOptions, tableName: 'projects' });

export const Deployment = sequelize.define('Deployment', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  project_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  commit_hash: { type: DataTypes.STRING },
  status: { type: DataTypes.STRING },
  environment: { type: DataTypes.STRING },
  duration: { type: DataTypes.INTEGER },
  logs: { type: DataTypes.TEXT },
  deployed_by: { type: DataTypes.INTEGER.UNSIGNED },
  rollback_target: { type: DataTypes.INTEGER.UNSIGNED },
  started_at: { type: DataTypes.DATE },
  completed_at: { type: DataTypes.DATE },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED }
}, { ...baseOptions, tableName: 'deployments' });

export const AlertRule = sequelize.define('AlertRule', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  project_id: { type: DataTypes.INTEGER.UNSIGNED },
  name: { type: DataTypes.STRING, allowNull: false },
  condition_type: { type: DataTypes.STRING },
  threshold_value: { type: DataTypes.FLOAT },
  comparison_operator: { type: DataTypes.STRING },
  duration_minutes: { type: DataTypes.INTEGER, defaultValue: 5 },
  escalation_chain: { type: DataTypes.JSON },
  notification_channels: { type: DataTypes.JSON },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  created_by: { type: DataTypes.INTEGER.UNSIGNED },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED }
}, { ...baseOptions, tableName: 'alert_rules' });

export const Incident = sequelize.define('Incident', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  project_id: { type: DataTypes.INTEGER.UNSIGNED },
  alert_rule_id: { type: DataTypes.INTEGER.UNSIGNED },
  title: { type: DataTypes.STRING },
  status: { type: DataTypes.STRING, defaultValue: 'open' },
  severity: { type: DataTypes.STRING, defaultValue: 'medium' },
  description: { type: DataTypes.TEXT },
  created_by: { type: DataTypes.INTEGER.UNSIGNED },
  assigned_to: { type: DataTypes.INTEGER.UNSIGNED },
  resolved_at: { type: DataTypes.DATE },
  resolution_notes: { type: DataTypes.TEXT },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED }
}, { ...baseOptions, tableName: 'incidents' });

export const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED },
  user_id: { type: DataTypes.INTEGER.UNSIGNED },
  type: { type: DataTypes.STRING },
  title: { type: DataTypes.STRING },
  message: { type: DataTypes.TEXT },
  data: { type: DataTypes.JSON },
  read: { type: DataTypes.BOOLEAN, defaultValue: false },
  priority: { type: DataTypes.STRING, defaultValue: 'normal' },
  expires_at: { type: DataTypes.DATE }
}, { ...baseOptions, tableName: 'notifications' });

export const Webhook = sequelize.define('Webhook', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  project_id: { type: DataTypes.INTEGER.UNSIGNED },
  name: { type: DataTypes.STRING },
  url: { type: DataTypes.STRING },
  secret: { type: DataTypes.STRING },
  events: { type: DataTypes.JSON },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  last_triggered: { type: DataTypes.DATE },
  created_by: { type: DataTypes.INTEGER.UNSIGNED }
}, { ...baseOptions, tableName: 'webhooks' });

export const BusinessAutomation = sequelize.define('BusinessAutomation', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  created_by: { type: DataTypes.INTEGER.UNSIGNED },
  name: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING, defaultValue: 'active' },
  config: { type: DataTypes.JSON },
  triggers: { type: DataTypes.JSON },
  actions: { type: DataTypes.JSON }
}, { ...baseOptions, tableName: 'business_automations' });

export const BusinessAutomationRun = sequelize.define('BusinessAutomationRun', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  automation_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  status: { type: DataTypes.STRING },
  input_data: { type: DataTypes.JSON },
  output_data: { type: DataTypes.JSON },
  error_message: { type: DataTypes.TEXT },
  duration_ms: { type: DataTypes.INTEGER },
  executed_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { ...baseOptions, tableName: 'business_automation_runs' });

export const BusinessLead = sequelize.define('BusinessLead', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  created_by: { type: DataTypes.INTEGER.UNSIGNED },
  name: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING },
  phone: { type: DataTypes.STRING },
  company: { type: DataTypes.STRING },
  budget: { type: DataTypes.FLOAT },
  score: { type: DataTypes.INTEGER },
  status: { type: DataTypes.STRING, defaultValue: 'new' },
  source: { type: DataTypes.STRING },
  notes: { type: DataTypes.TEXT },
  metadata: { type: DataTypes.JSON }
}, { ...baseOptions, tableName: 'business_leads' });

export const BusinessEmail = sequelize.define('BusinessEmail', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  created_by: { type: DataTypes.INTEGER.UNSIGNED },
  from_address: { type: DataTypes.STRING },
  to_address: { type: DataTypes.STRING },
  subject: { type: DataTypes.STRING },
  body: { type: DataTypes.TEXT },
  classification: { type: DataTypes.STRING },
  ai_score: { type: DataTypes.INTEGER },
  action_taken: { type: DataTypes.STRING },
  processed_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  metadata: { type: DataTypes.JSON }
}, { ...baseOptions, tableName: 'business_emails' });

export const IntegrationEvent = sequelize.define('IntegrationEvent', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  integration_id: { type: DataTypes.INTEGER.UNSIGNED },
  provider: { type: DataTypes.STRING, allowNull: false },
  entity_type: { type: DataTypes.STRING, allowNull: false },
  external_id: { type: DataTypes.STRING, allowNull: false },
  payload: { type: DataTypes.JSON },
  synced_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { ...baseOptions, tableName: 'integration_events' });

export const InfrastructureResource = sequelize.define('InfrastructureResource', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  project_id: { type: DataTypes.INTEGER.UNSIGNED },
  resource_type: { type: DataTypes.STRING },
  resource_id: { type: DataTypes.STRING },
  region: { type: DataTypes.STRING },
  status: { type: DataTypes.STRING },
  configuration: { type: DataTypes.JSON },
  cost_per_hour: { type: DataTypes.FLOAT },
  backup_enabled: { type: DataTypes.BOOLEAN, defaultValue: false },
  backup_schedule: { type: DataTypes.STRING },
  last_backup: { type: DataTypes.DATE }
}, { ...baseOptions, tableName: 'infrastructure_resources' });

export const AiInteraction = sequelize.define('AiInteraction', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  user_id: { type: DataTypes.INTEGER.UNSIGNED },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED },
  command: { type: DataTypes.TEXT },
  response: { type: DataTypes.TEXT },
  action_taken: { type: DataTypes.STRING },
  success: { type: DataTypes.BOOLEAN },
  feedback_rating: { type: DataTypes.INTEGER },
  feedback_comment: { type: DataTypes.TEXT },
  model_version: { type: DataTypes.STRING },
  confidence_score: { type: DataTypes.FLOAT }
}, { ...baseOptions, tableName: 'ai_interactions' });

export const SchemaMigration = sequelize.define('SchemaMigration', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
  applied_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { ...baseOptions, tableName: 'schema_migrations' });

export default {
  sequelize,
  Organization,
  User,
  OnboardingProfile,
  OnboardingSetting,
  GoLiveRequest,
  OrganizationInvite,
  Team,
  TeamMember,
  OpsModule,
  OrganizationOps,
  OpsPurchaseRequest,
  Template,
  Integration,
  IntegrationSecret,
  AuditLog,
  UserSetting,
  UserApiKey,
  LoginAttempt,
  UsageMetric,
  Project,
  Deployment,
  AlertRule,
  Incident,
  Notification,
  Webhook,
  BusinessAutomation,
  BusinessAutomationRun,
  BusinessLead,
  BusinessEmail,
  IntegrationEvent,
  InfrastructureResource,
  AiInteraction,
  SchemaMigration
};
