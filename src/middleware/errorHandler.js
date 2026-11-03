const ApiError = require('../utils/ApiError');

function notFound(req, res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

// PostgreSQL error codes we translate into client errors.
// https://www.postgresql.org/docs/current/errcodes-appendix.html
const PG_ERRORS = {
  23505: [409, 'A record with this value already exists'], // unique_violation
  23503: [409, 'This record is linked to another record'], // foreign_key_violation
  23514: [400, 'Value violates a database constraint'], // check_violation
  '22P02': [400, 'Invalid input syntax'], // invalid_text_representation
};

// Express recognises error handlers by their 4 arguments - keep `next` even though it is unused.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = 500;
  let message = 'Internal server error';
  let details;

  if (err instanceof ApiError) {
    ({ status, message, details } = err);
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Request body is not valid JSON';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request body is too large';
  } else if (PG_ERRORS[err.code]) {
    [status, message] = PG_ERRORS[err.code];
  }

  if (status >= 500) console.error(err);

  res.status(status).json({ error: { message, ...(details && { details }) } });
}

module.exports = { notFound, errorHandler };
