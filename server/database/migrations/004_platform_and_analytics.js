export const up = async ({ queryInterface, Sequelize }) => {
  const { DataTypes } = Sequelize;

  // Page-view / visit tracking (anonymous visitors too — user_id nullable).
  await queryInterface.createTable('page_views', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    session_id: { type: DataTypes.STRING },
    user_id: { type: DataTypes.INTEGER.UNSIGNED },
    organization_id: { type: DataTypes.INTEGER.UNSIGNED },
    email: { type: DataTypes.STRING },
    path: { type: DataTypes.STRING },
    referrer: { type: DataTypes.STRING },
    ip_address: { type: DataTypes.STRING },
    user_agent: { type: DataTypes.TEXT },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });

  await queryInterface.addIndex('page_views', ['session_id']);
  await queryInterface.addIndex('page_views', ['user_id']);
  await queryInterface.addIndex('page_views', ['created_at']);

  // Additional Aikya platform (team) admins, manageable from the admin panel.
  // Root admins still come from the PLATFORM_ADMIN_EMAILS env allow-list.
  await queryInterface.createTable('platform_admins', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    name: { type: DataTypes.STRING },
    added_by: { type: DataTypes.STRING },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });
};

export const down = async ({ queryInterface }) => {
  await queryInterface.dropTable('page_views');
  await queryInterface.dropTable('platform_admins');
};
