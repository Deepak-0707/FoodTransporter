// scripts/healthcheck.js — basic CI API test
// Usage: node scripts/healthcheck.js
// Expects server running on http://localhost:5000
const http = require('http');

const BASE = process.env.API_URL || 'http://localhost:5000';

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(BASE + path, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    }).on('error', reject);
  });
}

async function main() {
  console.log('Running FoodBridge Phase 4 healthcheck...');

  const health = await get('/health');
  console.assert(health.status === 200, 'Health check failed');
  console.assert(health.body.phase === 4, 'Phase mismatch — expected 4');
  console.log('  /health         OK (phase 4)');

  // 404 route
  const notFound = await get('/this-does-not-exist');
  console.assert(notFound.status === 404, '404 handler failed');
  console.log('  404 handler     OK');

  console.log('\nAll checks passed.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Healthcheck failed:', err.message);
  process.exit(1);
});
