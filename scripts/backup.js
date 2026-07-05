import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createGzip } from 'zlib';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { spawn } from 'child_process';

const pipe = promisify(pipeline);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKUP_DIR = path.join(__dirname, '../backups');

const parseMysqlUrl = (urlString) => {
  try {
    const url = new URL(urlString);
    return {
      host: url.hostname,
      port: url.port ? Number(url.port) : 3306,
      user: decodeURIComponent(url.username || ''),
      password: decodeURIComponent(url.password || ''),
      database: url.pathname ? url.pathname.replace(/^\//, '') : ''
    };
  } catch (error) {
    return null;
  }
};

const resolveConnection = () => {
  if (process.env.MYSQL_URL) {
    const parsed = parseMysqlUrl(process.env.MYSQL_URL);
    if (parsed) {
      return parsed;
    }
  }

  return {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || '',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || ''
  };
};

async function createBackup() {
  try {
    const { host, port, user, password, database } = resolveConnection();
    const sslEnabled = String(process.env.MYSQL_SSL || '').toLowerCase() === 'true';

    if (!user || !database) {
      throw new Error('MYSQL configuration missing. Set MYSQL_URL or MYSQL_HOST/MYSQL_USER/MYSQL_DATABASE.');
    }

    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}.sql.gz`);

    const dumpArgs = [
      `--host=${host}`,
      `--port=${port}`,
      `--user=${user}`,
      '--single-transaction',
      '--quick',
      '--routines',
      '--events',
      '--triggers',
      '--databases',
      database
    ];

    if (sslEnabled) {
      dumpArgs.push('--ssl-mode=REQUIRED');
    }

    const dumpProcess = spawn('mysqldump', dumpArgs, {
      env: { ...process.env, MYSQL_PWD: password || '' },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    dumpProcess.stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });

    const gzip = createGzip();
    const writeStream = fs.createWriteStream(backupPath);

    const pipelinePromise = pipe(dumpProcess.stdout, gzip, writeStream);

    const exitCode = await new Promise((resolve, reject) => {
      dumpProcess.on('error', reject);
      dumpProcess.on('close', resolve);
    });

    await pipelinePromise;

    if (exitCode !== 0) {
      throw new Error(`mysqldump exited with code ${exitCode}`);
    }

    console.log(`Backup created successfully: ${backupPath}`);

    const files = fs.readdirSync(BACKUP_DIR);
    const oldFiles = files
      .map(file => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
        created: fs.statSync(path.join(BACKUP_DIR, file)).birthtime
      }))
      .filter(file => {
        const daysOld = (new Date() - file.created) / (1000 * 60 * 60 * 24);
        return daysOld > 7;
      });

    oldFiles.forEach(file => {
      fs.unlinkSync(file.path);
      console.log(`Deleted old backup: ${file.name}`);
    });
  } catch (error) {
    console.error('Backup failed:', error);
    process.exit(1);
  }
}

createBackup();
