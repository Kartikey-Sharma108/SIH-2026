require('dotenv').config();
const { Client } = require('pg');

// Show what's being parsed
const url = new URL(process.env.DATABASE_URL);
console.log('Parsed connection details:');
console.log('  Host:', url.hostname);
console.log('  Port:', url.port);
console.log('  User:', url.username);
console.log('  Pass:', url.password);
console.log('  DB:  ', url.pathname.slice(1));
console.log('');

// Try connecting with explicit params (bypasses URL parsing)
const client = new Client({
  host: 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: 6543,
  user: 'postgres.lmaucnksvzadfpqfzgxi',
  password: 'QAZWSXa_123',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

client.connect()
  .then(() => {
    console.log('✅ Connected successfully!');
    return client.end();
  })
  .catch((err) => {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
  });
