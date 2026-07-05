import { Sequelize } from 'sequelize';
import { fileURLToPath } from 'url';
import { dirname, resolve, isAbsolute } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Choose the database dialect from the environment.
// - DB_DIALECT=sqlite  -> local/testing (file-based, zero external deps)
// - DB_DIALECT=mysql   -> production (default when not set)
const resolveDialect = () => {
  const explicit = String(process.env.DB_DIALECT || '').toLowerCase().trim();
  if (explicit === 'sqlite' || explicit === 'mysql') {
    return explicit;
  }
  // Backwards compatible default: MySQL unless clearly running SQLite.
  return 'mysql';
};

const buildSqlite = () => {
  const configured = process.env.SQLITE_STORAGE || 'devops_ai.sqlite';
  const storage = isAbsolute(configured)
    ? configured
    : resolve(__dirname, '../../', configured);

  return new Sequelize({
    dialect: 'sqlite',
    storage,
    logging: false
  });
};

const buildMysql = () => {
  const url = process.env.MYSQL_URL;
  const sslEnabled = String(process.env.MYSQL_SSL || '').toLowerCase() === 'true';

  if (url) {
    return new Sequelize(url, {
      dialect: 'mysql',
      logging: false,
      dialectOptions: sslEnabled ? { ssl: { rejectUnauthorized: false } } : {}
    });
  }

  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const port = Number(process.env.MYSQL_PORT || 3306);
  const username = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'aikya';

  return new Sequelize(database, username, password, {
    host,
    port,
    dialect: 'mysql',
    logging: false,
    dialectOptions: sslEnabled ? { ssl: { rejectUnauthorized: false } } : {}
  });
};

const buildSequelize = () => {
  return resolveDialect() === 'sqlite' ? buildSqlite() : buildMysql();
};

export const dialect = resolveDialect();
export const sequelize = buildSequelize();
