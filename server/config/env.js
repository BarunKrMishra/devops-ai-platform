import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load default .env from current working directory first
dotenv.config();

// Ensure project-root .env is loaded regardless of where the process starts
dotenv.config({ path: resolve(__dirname, '../../.env') });

const NODE_ENV = process.env.NODE_ENV || 'development';

const requireEnv = (key) => {
  const value = process.env[key];
  if (!value) {
    if (NODE_ENV === 'production') {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    console.warn(`[env] ${key} is not set. Some features may not work as expected.`);
  }
  return value;
};

const validateSecrets = () => {
  requireEnv('JWT_SECRET');
  requireEnv('INTEGRATION_MASTER_KEY');
  // MySQL connection details are only required when actually using MySQL.
  // SQLite (DB_DIALECT=sqlite) is self-contained and needs no host/user/db.
  const usingSqlite = String(process.env.DB_DIALECT || '').toLowerCase().trim() === 'sqlite';
  if (!usingSqlite && !process.env.MYSQL_URL) {
    requireEnv('MYSQL_HOST');
    requireEnv('MYSQL_USER');
    requireEnv('MYSQL_DATABASE');
  }

  const jwtSecret = process.env.JWT_SECRET || '';
  if (jwtSecret && jwtSecret.length < 24) {
    console.warn('[env] JWT_SECRET should be at least 24 characters long.');
  }
};

validateSecrets();

if (NODE_ENV === 'production') {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
}
