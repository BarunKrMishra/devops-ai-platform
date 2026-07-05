export const up = async ({ queryInterface, Sequelize }) => {
  const { DataTypes } = Sequelize;

  await queryInterface.createTable('integration_events', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    integration_id: { type: DataTypes.INTEGER.UNSIGNED },
    provider: { type: DataTypes.STRING, allowNull: false },
    entity_type: { type: DataTypes.STRING, allowNull: false },
    external_id: { type: DataTypes.STRING, allowNull: false },
    payload: { type: DataTypes.JSON },
    synced_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });

  await queryInterface.addIndex('integration_events', ['organization_id', 'provider']);
  await queryInterface.addIndex('integration_events', ['provider', 'entity_type']);
  await queryInterface.addIndex('integration_events', ['synced_at']);
  await queryInterface.addConstraint('integration_events', {
    fields: ['organization_id', 'provider', 'entity_type', 'external_id'],
    type: 'unique',
    name: 'uniq_integration_events_org_provider_entity_external'
  });
};

export const down = async ({ queryInterface }) => {
  await queryInterface.dropTable('integration_events');
};
