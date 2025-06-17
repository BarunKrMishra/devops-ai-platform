# Production Deployment Guide

This guide explains how to deploy the AI DevOps Platform to a production environment.

## Prerequisites

1. A Linux server (Ubuntu 20.04 LTS recommended)
2. Domain name pointing to your server
3. Node.js 16.x or later
4. Nginx
5. PM2 (will be installed during deployment)
6. Let's Encrypt SSL certificate

## Initial Server Setup

1. Update system packages:
```bash
sudo apt update && sudo apt upgrade -y
```

2. Install required packages:
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

3. Install Node.js 16.x:
```bash
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt install -y nodejs
```

4. Install PM2 globally:
```bash
sudo npm install -g pm2
```

## SSL Certificate Setup

1. Get SSL certificate from Let's Encrypt:
```bash
sudo certbot --nginx -d your-domain.com
```

## Application Deployment

1. Clone the repository:
```bash
git clone <repository-url>
cd ai-devops-platform
```

2. Create production environment file:
```bash
cp .env.example .env
```

3. Update the `.env` file with production values:
```
NODE_ENV=production
PORT=3001
JWT_SECRET=<strong-random-string>
DATABASE_PATH=/path/to/production/database.db
API_URL=https://your-domain.com
VITE_API_URL=https://your-domain.com
CORS_ORIGIN=https://your-domain.com
```

4. Install dependencies and build:
```bash
npm install
npm run build
```

5. Copy Nginx configuration:
```bash
sudo cp nginx.conf /etc/nginx/nginx.conf
sudo nginx -t
sudo systemctl restart nginx
```

6. Run the deployment script:
```bash
node scripts/deploy.js
```

## Database Backup Setup

1. Create a backup directory:
```bash
mkdir -p /path/to/backups
```

2. Set up daily backups with cron:
```bash
crontab -e
```

Add the following line:
```
0 0 * * * /usr/bin/node /path/to/project/scripts/backup.js
```

## Monitoring Setup

1. Configure PM2 monitoring:
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

2. Enable PM2 startup script:
```bash
pm2 startup
pm2 save
```

3. Monitor the application:
```bash
pm2 monit
```

4. View logs:
```bash
pm2 logs ai-devops-platform
```

## Security Measures

1. Configure firewall:
```bash
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
```

2. Set up fail2ban:
```bash
sudo apt install fail2ban
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo systemctl restart fail2ban
```

3. Regular security updates:
```bash
# Add to crontab
0 3 * * * apt-get update && apt-get upgrade -y
```

## Maintenance Tasks

1. Regular database backups (automated)
2. Log rotation (configured with PM2)
3. SSL certificate renewal (automated with certbot)
4. Security updates (automated)
5. Monitor disk space and system resources

## Troubleshooting

1. Check application logs:
```bash
pm2 logs ai-devops-platform
```

2. Check Nginx logs:
```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

3. Check SSL certificate:
```bash
sudo certbot certificates
```

4. Restart services:
```bash
pm2 restart ai-devops-platform
sudo systemctl restart nginx
```

## Rollback Procedure

1. Stop the current deployment:
```bash
pm2 stop ai-devops-platform
```

2. Restore from backup:
```bash
# Restore database
cp /path/to/backups/latest-backup.db.gz .
gunzip latest-backup.db.gz
mv latest-backup.db devops_ai.db
```

3. Switch to previous version:
```bash
git checkout <previous-version-tag>
npm install
npm run build
```

4. Restart the application:
```bash
pm2 restart ai-devops-platform
```

## Performance Optimization

1. Enable Nginx caching:
```bash
sudo mkdir -p /var/cache/nginx
```

2. Monitor application performance:
```bash
pm2 monit
```

3. Use compression for static files (configured in Nginx)

4. Implement CDN for static assets if needed

## Health Checks

1. API health check endpoint: `https://your-domain.com/api/health`
2. Monitor WebSocket connections: `pm2 monit`
3. Database connection status: Check application logs
4. SSL certificate status: `sudo certbot certificates`

## Support

For issues or questions:
1. Check the logs: `pm2 logs`
2. Review error tracking system
3. Contact support team

Remember to regularly:
- Monitor system resources
- Review security updates
- Check application logs
- Verify backup integrity
- Update SSL certificates
- Run security audits 