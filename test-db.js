import { initDatabase } from './server/database/init.js';

console.log('Testing database initialization...');

try {
  await initDatabase();
  console.log('✅ Database initialization successful!');
  
  // Test query to verify users table
  const { db } = await import('./server/database/init.js');
  const users = db.prepare('SELECT id, email, two_factor_secret FROM users LIMIT 5').all();
  console.log('Users in database:', users.map(u => ({ id: u.id, email: u.email, hasSecret: !!u.two_factor_secret })));
  
  console.log('✅ All tests passed!');
} catch (error) {
  console.error('❌ Database initialization failed:', error);
  process.exit(1);
} 