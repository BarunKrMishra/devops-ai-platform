import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function deploy() {
  try {
    console.log('Starting deployment process...');

    // 1. Run security checks
    console.log('Running security checks...');
    await execAsync('npm run security-check');

    // 2. Run tests
    console.log('Running tests...');
    await execAsync('npm test');

    // 3. Create backup
    console.log('Creating database backup...');
    await execAsync('npm run backup');

    // 4. Build frontend
    console.log('Building frontend...');
    await execAsync('npm run build');

    // 5. Check if PM2 is installed
    try {
      await execAsync('pm2 -v');
    } catch (error) {
      console.log('Installing PM2...');
      await execAsync('npm install -g pm2');
    }

    // 6. Update environment to production
    const envPath = path.join(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      envContent = envContent.replace(/NODE_ENV=.*$/m, 'NODE_ENV=production');
      fs.writeFileSync(envPath, envContent);
    }

    // 7. Restart PM2 process or start new one
    console.log('Starting/Restarting server with PM2...');
    try {
      await execAsync('pm2 restart ai-devops-platform');
    } catch (error) {
      await execAsync('pm2 start server/index.js --name ai-devops-platform');
    }

    // 8. Save PM2 process list
    await execAsync('pm2 save');

    console.log('Deployment completed successfully!');
    console.log('Monitor the application with: pm2 monit');
    console.log('View logs with: pm2 logs ai-devops-platform');

  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
}

deploy(); 