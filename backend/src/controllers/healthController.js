// Health controller - cheap liveness probe used by Render and uptime checks.

const { mongoose } = require('../config/db');

async function health(_req, res) {
  return res.json({
    success: true,
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
}

module.exports = { health };
