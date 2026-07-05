#!/usr/bin/env node

/**
 * Test deployment configuration and connectivity
 * Usage: node scripts/test-deployment.js [backend-url]
 */

// Uses Node's built-in global fetch (Node 18+); no external dependency needed.

const BACKEND_URL = process.argv[2] || 'http://localhost:3001';

console.log('🔍 Testing deployment configuration...\n');

async function testEndpoint(url, description) {
  try {
    console.log(`Testing ${description}...`);
    const response = await fetch(url);
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ ${description}: SUCCESS`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Response:`, data);
    } else {
      console.log(`❌ ${description}: FAILED`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Error:`, data);
    }
  } catch (error) {
    console.log(`❌ ${description}: ERROR`);
    console.log(`   Error: ${error.message}`);
  }
  console.log('');
}

async function testAuthEndpoints() {
  console.log('🔐 Testing Authentication Endpoints...\n');
  
  // Test password reset request
  try {
    console.log('Testing password reset request...');
    const response = await fetch(`${BACKEND_URL}/api/auth/request-password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' })
    });
    
    const responseText = await response.text();
    console.log(`Status: ${response.status}`);
    console.log(`Response: ${responseText}`);
    
    if (response.ok) {
      console.log('✅ Password reset endpoint: SUCCESS');
    } else {
      console.log('❌ Password reset endpoint: FAILED');
    }
  } catch (error) {
    console.log(`❌ Password reset endpoint: ERROR - ${error.message}`);
  }
  console.log('');
}

async function main() {
  console.log(`Backend URL: ${BACKEND_URL}\n`);
  
  // Test basic connectivity
  await testEndpoint(`${BACKEND_URL}/api/health`, 'Health Check');
  
  // Test authentication endpoints
  await testAuthEndpoints();
  
  // Test CORS headers
  try {
    console.log('Testing CORS headers...');
    const response = await fetch(`${BACKEND_URL}/api/health`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://test.netlify.app',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers')
    };
    
    console.log('CORS Headers:', corsHeaders);
    
    if (corsHeaders['Access-Control-Allow-Origin']) {
      console.log('✅ CORS: SUCCESS');
    } else {
      console.log('❌ CORS: FAILED - No CORS headers found');
    }
  } catch (error) {
    console.log(`❌ CORS test: ERROR - ${error.message}`);
  }
  
  console.log('\n🎯 Deployment Test Complete!');
  console.log('\nNext steps:');
  console.log('1. If all tests pass, your backend is ready for deployment');
  console.log('2. Deploy your backend to Render/Railway/Heroku');
  console.log('3. Update VITE_API_URL in your frontend environment');
  console.log('4. Deploy your frontend to Netlify');
}

main().catch(console.error); 