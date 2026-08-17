// ============================================================================
// AI Security Gateway — Express Server Entry Point
// ============================================================================

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

// ── Database connection pool ────────────────────────────────────────────────
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
});

// Verify DB connection on startup
pool.query('SELECT NOW()')
  .then(() => console.log('✅  Connected to Postgres'))
  .catch((err) => {
    console.error('❌  Failed to connect to Postgres:', err.message);
    process.exit(1);
  });

// ── Express app ─────────────────────────────────────────────────────────────
const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Make the pool available to route handlers via req.app.locals
app.locals.pool = pool;

// ── Routes ──────────────────────────────────────────────────────────────────
const analyzeRouter = require('./routes/analyze');
const logsRouter = require('./routes/logs');

app.use('/api/analyze', analyzeRouter);
app.use('/api/logs', logsRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Global error handler ────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start server ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀  AI Security Gateway listening on http://localhost:${PORT}`);
  console.log(`   Risk threshold: ${process.env.RISK_THRESHOLD || 70}`);
});

module.exports = app;
