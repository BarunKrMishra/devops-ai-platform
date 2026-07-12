import { Sequelize } from 'sequelize';
import { fileURLToPath } from 'url';
import { dirname, resolve, isAbsolute } from 'path';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Choose the database dialect from the environment.
// - DB_DIALECT=sqlite   -> local/testing (file-based, zero external deps)
// - DB_DIALECT=postgres -> production (Supabase / any managed Postgres)
// - DB_DIALECT=mysql    -> production (managed MySQL)
const resolveDialect = () => {
  const explicit = String(process.env.DB_DIALECT || '').toLowerCase().trim();
  if (explicit === 'postgres' || explicit === 'postgresql') {
    return 'postgres';
  }
  if (explicit === 'sqlite' || explicit === 'mysql') {
    return explicit;
  }
  // Backwards compatible default: MySQL unless clearly running SQLite/Postgres.
  return 'mysql';
};

const buildSqlite = () => {
  const configured = process.env.SQLITE_STORAGE || 'devops_ai.sqlite';
  const storage = isAbsolute(configured)
    ? configured
    : resolve(__dirname, '../../', configured);

  // Ensure the parent directory exists. On container platforms the SQLite file
  // lives on a mounted volume (e.g. /data/devops_ai.sqlite); if the directory
  // isn't present yet, SQLite fails with SQLITE_CANTOPEN. Creating it is a no-op
  // when it already exists.
  try {
    mkdirSync(dirname(storage), { recursive: true });
  } catch {
    // Directory may already exist or be unwritable at build time; the actual
    // open will surface a clear error if the path is genuinely unusable.
  }

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

const buildPostgres = () => {
  // Supabase (and most managed Postgres) hand you a single connection string.
  // Accept the common names; DATABASE_URL is Supabase's default.
  const url = process.env.DATABASE_URL
    || process.env.POSTGRES_URL
    || process.env.SUPABASE_DB_URL;

  // Managed Postgres requires TLS. rejectUnauthorized:false accepts the
  // provider's certificate chain without bundling a CA (standard for Supabase).
  const sslDisabled = String(process.env.POSTGRES_SSL || '').toLowerCase() === 'false';
  const common = {
    dialect: 'postgres',
    logging: false,
    dialectOptions: sslDisabled ? {} : { ssl: { require: true, rejectUnauthorized: false } },
    pool: { max: Number(process.env.POSTGRES_POOL_MAX || 5), min: 0, idle: 10000 }
  };

  if (url) {
    return new Sequelize(url, common);
  }

  const host = process.env.PGHOST || process.env.POSTGRES_HOST || '127.0.0.1';
  const port = Number(process.env.PGPORT || process.env.POSTGRES_PORT || 5432);
  const username = process.env.PGUSER || process.env.POSTGRES_USER || 'postgres';
  const password = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || '';
  const database = process.env.PGDATABASE || process.env.POSTGRES_DB || 'postgres';

  return new Sequelize(database, username, password, { host, port, ...common });
};

const buildSequelize = () => {
  const resolved = resolveDialect();
  if (resolved === 'sqlite') return buildSqlite();
  if (resolved === 'postgres') return buildPostgres();
  return buildMysql();
};

export const dialect = resolveDialect();
export const sequelize = buildSequelize();

// Dialect-aware "format a timestamp as YYYY-MM-DD" expression, for day-bucketed
// aggregates. Each engine names the function differently.
export const dayBucket = (columnName) => {
  const column = Sequelize.col(columnName);
  if (dialect === 'postgres') return Sequelize.fn('TO_CHAR', column, 'YYYY-MM-DD');
  if (dialect === 'sqlite') return Sequelize.fn('strftime', '%Y-%m-%d', column);
  return Sequelize.fn('DATE_FORMAT', column, '%Y-%m-%d');
};
