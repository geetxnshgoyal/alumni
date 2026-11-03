const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const env = require('./config/env');
const apiRoutes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Render, Railway etc. sit behind a proxy; needed for correct client IPs in rate limiting.
if (env.NODE_ENV === 'production') app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: { 'img-src': ["'self'", 'data:', 'https:'] }, // profile photos may be hosted elsewhere
    },
  })
);
app.use(cors({ origin: env.corsOrigins.length ? env.corsOrigins : false }));
app.use(express.json({ limit: '100kb' }));
if (env.NODE_ENV !== 'test') app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use('/api', apiRoutes);
app.use('/api', notFound);

// Web frontend (also installable on phones as a PWA)
app.use(express.static(path.join(__dirname, '../public')));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
