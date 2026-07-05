export const up = async ({ queryInterface, Sequelize }) => {
  const { DataTypes } = Sequelize;

  await queryInterface.createTable('organizations', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    slug: { type: DataTypes.STRING, allowNull: false, unique: true },
    plan: { type: DataTypes.STRING, allowNull: false, defaultValue: 'free' },
    billing_email: { type: DataTypes.STRING },
    seat_limit: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 10 },
    settings: { type: DataTypes.JSON },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });

  await queryInterface.createTable('users', {
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
    github_token: { type: DataTypes.TEXT },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });

  await queryInterface.addIndex('users', ['organization_id']);

  await queryInterface.createTable('onboarding_profiles', {
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
    consent_privacy: { type: DataTypes.BOOLEAN, defaultValue: false },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });

  await queryInterface.createTable('organization_settings', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
    demo_mode: { type: DataTypes.BOOLEAN, defaultValue: true },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });

  await queryInterface.createTable('user_settings', {
    user_id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true },
    notifications: { type: DataTypes.JSON },
    experience: { type: DataTypes.JSON },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });

  await queryInterface.createTable('user_api_keys', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    name: { type: DataTypes.STRING },
    key_hash: { type: DataTypes.STRING, allowNull: false },
    last_four: { type: DataTypes.STRING },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    last_used: { type: DataTypes.DATE },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });

  await queryInterface.createTable('teams', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    created_by: { type: DataTypes.INTEGER.UNSIGNED },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });

  await queryInterface.addIndex('teams', ['organization_id', 'name'], { unique: true });

  await queryInterface.createTable('team_members', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    team_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    organization_id: { type: DataTypes.INTEGER.UNSIGNED },
    role: { type: DataTypes.STRING, defaultValue: 'member' },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });

  await queryInterface.addIndex('team_members', ['team_id', 'user_id'], { unique: true });

  await queryInterface.createTable('organization_invites', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.STRING, defaultValue: 'developer' },
    team_ids: { type: DataTypes.JSON },
    token: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: 'pending' },
    invited_by: { type: DataTypes.INTEGER.UNSIGNED },
    expires_at: { type: DataTypes.DATE },
    accepted_at: { type: DataTypes.DATE },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });

  await queryInterface.addIndex('organization_invites', ['organization_id', 'email'], { unique: true });

  await queryInterface.createTable('go_live_requests', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    requester_id: { type: DataTypes.INTEGER.UNSIGNED },
    selected_features: { type: DataTypes.JSON },
    requirements_notes: { type: DataTypes.TEXT },
    contact_email: { type: DataTypes.STRING },
    ai_integration: { type: DataTypes.BOOLEAN, defaultValue: false },
    ai_provider: { type: DataTypes.STRING },
    ai_integration_method: { type: DataTypes.STRING },
    ai_integration_notes: { type: DataTypes.TEXT },
    data_sources: { type: DataTypes.JSON },
    live_data_notes: { type: DataTypes.TEXT },
    integration_details: { type: DataTypes.JSON },
    status: { type: DataTypes.STRING, defaultValue: 'pending' },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });

  await queryInterface.createTable('ops_modules', {
    key: { type: DataTypes.STRING, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    category: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    ai_enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
    metadata: { type: DataTypes.JSON },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });

  await queryInterface.createTable('organization_ops', {
    organization_id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true },
    module_key: { type: DataTypes.STRING, primaryKey: true },
    enabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    configured: { type: DataTypes.BOOLEAN, defaultValue: false },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });

  await queryInterface.createTable('templates', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    category: { type: DataTypes.STRING },
    template_data: { type: DataTypes.JSON },
    is_public: { type: DataTypes.BOOLEAN, defaultValue: false },
    created_by: { type: DataTypes.INTEGER.UNSIGNED },
    organization_id: { type: DataTypes.INTEGER.UNSIGNED },
    tags: { type: DataTypes.JSON },
    version: { type: DataTypes.STRING, defaultValue: '1.0.0' },
    downloads: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });

  await queryInterface.createTable('projects', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED },
    organization_id: { type: DataTypes.INTEGER.UNSIGNED },
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
    settings: { type: DataTypes.JSON },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });

  await queryInterface.createTable('deployments', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    project_id: { type: DataTypes.INTEGER.UNSIGNED },
    commit_hash: { type: DataTypes.STRING },
    status: { type: DataTypes.STRING },
    environment: { type: DataTypes.STRING },
    duration: { type: DataTypes.INTEGER },
    logs: { type: DataTypes.TEXT },
    deployed_by: { type: DataTypes.INTEGER.UNSIGNED },
    rollback_target: { type: DataTypes.INTEGER.UNSIGNED },
    started_at: { type: DataTypes.DATE },
    completed_at: { type: DataTypes.DATE },
    organization_id: { type: DataTypes.INTEGER.UNSIGNED },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });

  await queryInterface.createTable('infrastructure_resources', {
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
    last_backup: { type: DataTypes.DATE },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });

  await queryInterface.createTable('integrations', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    configuration: { type: DataTypes.JSON },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    last_sync: { type: DataTypes.DATE },
    created_by: { type: DataTypes.INTEGER.UNSIGNED },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });

  await queryInterface.createTable('integration_secrets', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    integration_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    encrypted_payload: { type: DataTypes.JSON, allowNull: false },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });

  await queryInterface.createTable('notifications', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED },
    organization_id: { type: DataTypes.INTEGER.UNSIGNED },
    type: { type: DataTypes.STRING },
    title: { type: DataTypes.STRING },
    message: { type: DataTypes.TEXT },
    data: { type: DataTypes.JSON },
    read: { type: DataTypes.BOOLEAN, defaultValue: false },
    priority: { type: DataTypes.STRING, defaultValue: 'normal' },
    expires_at: { type: DataTypes.DATE },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });

  await queryInterface.createTable('alert_rules', {
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
    organization_id: { type: DataTypes.INTEGER.UNSIGNED },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });

  await queryInterface.createTable('incidents', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    project_id: { type: DataTypes.INTEGER.UNSIGNED },
    alert_rule_id: { type: DataTypes.INTEGER.UNSIGNED },
    title: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT },
    severity: { type: DataTypes.STRING, defaultValue: 'medium' },
    status: { type: DataTypes.STRING, defaultValue: 'open' },
    assigned_to: { type: DataTypes.INTEGER.UNSIGNED },
    resolved_at: { type: DataTypes.DATE },
    resolution_notes: { type: DataTypes.TEXT },
    created_by: { type: DataTypes.INTEGER.UNSIGNED },
    organization_id: { type: DataTypes.INTEGER.UNSIGNED },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });

  await queryInterface.createTable('audit_logs', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED },
    organization_id: { type: DataTypes.INTEGER.UNSIGNED },
    action: { type: DataTypes.STRING, allowNull: false },
    resource_type: { type: DataTypes.STRING },
    resource_id: { type: DataTypes.STRING },
    details: { type: DataTypes.JSON },
    ip_address: { type: DataTypes.STRING },
    user_agent: { type: DataTypes.TEXT },
    session_id: { type: DataTypes.STRING },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });

  await queryInterface.createTable('ai_interactions', {
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
    confidence_score: { type: DataTypes.FLOAT },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });

  await queryInterface.createTable('business_automations', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    created_by: { type: DataTypes.INTEGER.UNSIGNED },
    name: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: 'active' },
    config: { type: DataTypes.JSON },
    triggers: { type: DataTypes.JSON },
    actions: { type: DataTypes.JSON },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });

  await queryInterface.createTable('business_automation_runs', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    automation_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    status: { type: DataTypes.STRING },
    input_data: { type: DataTypes.JSON },
    output_data: { type: DataTypes.JSON },
    error_message: { type: DataTypes.TEXT },
    duration_ms: { type: DataTypes.INTEGER },
    executed_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });

  await queryInterface.createTable('business_leads', {
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
    metadata: { type: DataTypes.JSON },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });

  await queryInterface.createTable('business_emails', {
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
    processed_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    metadata: { type: DataTypes.JSON },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });

  await queryInterface.createTable('webhooks', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    project_id: { type: DataTypes.INTEGER.UNSIGNED },
    name: { type: DataTypes.STRING },
    url: { type: DataTypes.STRING },
    secret: { type: DataTypes.STRING },
    events: { type: DataTypes.JSON },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    last_triggered: { type: DataTypes.DATE },
    created_by: { type: DataTypes.INTEGER.UNSIGNED },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });

  await queryInterface.createTable('usage_metrics', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    metric_type: { type: DataTypes.STRING, allowNull: false },
    value: { type: DataTypes.FLOAT, allowNull: false },
    unit: { type: DataTypes.STRING, allowNull: false },
    recorded_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });

  await queryInterface.createTable('login_attempts', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    email: { type: DataTypes.STRING },
    success: { type: DataTypes.BOOLEAN },
    timestamp: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    ip_address: { type: DataTypes.STRING },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });
};

export const down = async ({ queryInterface }) => {
  await queryInterface.dropTable('login_attempts');
  await queryInterface.dropTable('usage_metrics');
  await queryInterface.dropTable('webhooks');
  await queryInterface.dropTable('business_emails');
  await queryInterface.dropTable('business_leads');
  await queryInterface.dropTable('business_automation_runs');
  await queryInterface.dropTable('business_automations');
  await queryInterface.dropTable('ai_interactions');
  await queryInterface.dropTable('audit_logs');
  await queryInterface.dropTable('incidents');
  await queryInterface.dropTable('alert_rules');
  await queryInterface.dropTable('notifications');
  await queryInterface.dropTable('integration_secrets');
  await queryInterface.dropTable('integrations');
  await queryInterface.dropTable('infrastructure_resources');
  await queryInterface.dropTable('deployments');
  await queryInterface.dropTable('projects');
  await queryInterface.dropTable('templates');
  await queryInterface.dropTable('organization_ops');
  await queryInterface.dropTable('ops_modules');
  await queryInterface.dropTable('go_live_requests');
  await queryInterface.dropTable('organization_invites');
  await queryInterface.dropTable('team_members');
  await queryInterface.dropTable('teams');
  await queryInterface.dropTable('user_api_keys');
  await queryInterface.dropTable('user_settings');
  await queryInterface.dropTable('organization_settings');
  await queryInterface.dropTable('onboarding_profiles');
  await queryInterface.dropTable('users');
  await queryInterface.dropTable('organizations');
};
