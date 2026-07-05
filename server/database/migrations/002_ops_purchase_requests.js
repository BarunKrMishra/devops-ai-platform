export const up = async ({ queryInterface, Sequelize }) => {
  const { DataTypes } = Sequelize;

  await queryInterface.createTable('ops_purchase_requests', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    module_key: { type: DataTypes.STRING, allowNull: false },
    requested_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
    notes: { type: DataTypes.TEXT },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
  });

  await queryInterface.addIndex('ops_purchase_requests', ['organization_id', 'module_key']);
  await queryInterface.addIndex('ops_purchase_requests', ['status']);
  await queryInterface.addConstraint('ops_purchase_requests', {
    fields: ['organization_id', 'module_key', 'status'],
    type: 'unique',
    name: 'uniq_ops_purchase_requests_org_module_status'
  });
};

export const down = async ({ queryInterface }) => {
  await queryInterface.dropTable('ops_purchase_requests');
};
