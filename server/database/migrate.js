import '../config/env.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { sequelize } from './sequelize.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ensureMigrationsTable = async () => {
  await sequelize.getQueryInterface().createTable('schema_migrations', {
    id: { type: sequelize.Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: sequelize.Sequelize.STRING, allowNull: false, unique: true },
    applied_at: { type: sequelize.Sequelize.DATE, defaultValue: sequelize.Sequelize.literal('CURRENT_TIMESTAMP') },
    created_at: { type: sequelize.Sequelize.DATE, defaultValue: sequelize.Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: sequelize.Sequelize.DATE, defaultValue: sequelize.Sequelize.literal('CURRENT_TIMESTAMP') }
  }).catch(() => {
    // Table already exists
  });
};

const getAppliedMigrations = async () => {
  const [rows] = await sequelize.query('SELECT name FROM schema_migrations');
  return new Set(rows.map((row) => row.name));
};

const recordMigration = async (name) => {
  await sequelize.query('INSERT INTO schema_migrations (name) VALUES (?)', {
    replacements: [name]
  });
};

export const runMigrations = async () => {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.js'))
    .sort();

  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }
    const migrationPath = path.join(migrationsDir, file);
    const migrationUrl = pathToFileURL(migrationPath).href;
    const migration = await import(migrationUrl);
    if (typeof migration.up !== 'function') {
      throw new Error(`Migration ${file} is missing an up() function.`);
    }

    await migration.up({ queryInterface: sequelize.getQueryInterface(), Sequelize: sequelize.Sequelize });
    await recordMigration(file);
    console.log(`Applied migration: ${file}`);
  }
};

// Only run automatically when this file is the entry point (node migrate.js),
// not when it is imported by the server. Compare against argv[1], since
// import.meta.url always equals this module's own __filename.
const invokedDirectly = process.argv[1]
  && pathToFileURL(process.argv[1]).href === import.meta.url;

if (invokedDirectly) {
  runMigrations()
    .then(() => {
      console.log('Migrations complete.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
