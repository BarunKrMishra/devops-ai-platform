import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createGzip } from 'zlib';
import { pipeline } from 'stream';
import { promisify } from 'util';

const pipe = promisify(pipeline);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DATABASE_PATH || './devops_ai.db';
const BACKUP_DIR = path.join(__dirname, '../backups');

async function createBackup() {
  try {
    // Create backups directory if it doesn't exist
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // Generate backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}.db.gz`);

    // Create read stream from database
    const readStream = fs.createReadStream(DB_PATH);
    
    // Create write stream to backup file
    const writeStream = fs.createWriteStream(backupPath);
    
    // Create gzip transform stream
    const gzip = createGzip();

    // Pipe the streams together
    await pipe(readStream, gzip, writeStream);

    console.log(`Backup created successfully: ${backupPath}`);

    // Clean up old backups (keep last 7 days)
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