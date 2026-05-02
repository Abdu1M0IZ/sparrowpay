// Express app factory. Server entry point (server.js) imports this and
// listens on a port. Tests import this directly via supertest without
// listening on a port.

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const env = require('./config/env');
const { apiLimiter } = require('./middleware/rateLimitMiddleware');
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');

const authRoutes = require('./routes/authRoutes');
const meRoutes = require('./routes/meRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const donationRoutes = require('./routes/donationRoutes');
const healthRoutes = require('./routes/healthRoutes');

function buildApp() {
  const app = express();

  // Trust the proxy in front of us (Render terminates TLS) so req.ip is correct.
  app.set('trust proxy', 1);

  // Security headers and parsing.
  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // CORS - allow configured origins.
  const corsOpts = {
    origin: (origin, cb) => {
      // Allow non-browser tools (curl, server-to-server) where origin is undefined.
      if (!origin) return cb(null, true);
      if (env.corsOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
  app.use(cors(corsOpts));

  if (!env.isTest) app.use(morgan('dev'));

  // Apply API-wide rate limiter under /api.
  app.use('/api', apiLimiter);

  // Routes.
  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/me', meRoutes);
  app.use('/api/transactions', transactionRoutes);
  app.use('/api/favorites', favoriteRoutes);
  app.use('/api/donations', donationRoutes);

  // Friendly root.
  app.get('/', (_req, res) => {
    res.json({
      success: true,
      name: 'SparrowPay API',
      version: '1.0.0',
      docs: 'See /api/health for liveness.',
    });
  });

  // 404 + error handlers must come last.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = buildApp();
module.exports.buildApp = buildApp;
