const ApiError = require('../utils/ApiError');

// validate({ body, query, params }) - each is an optional zod schema.
// Parsed (and type-coerced) values are stored on req.valid.body / req.valid.query / req.valid.params.
// (Express 5 makes req.query read-only, so we never overwrite it.)
const validate = (schemas) => (req, res, next) => {
  req.valid = {};
  const details = [];

  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (result.success) {
      req.valid[part] = result.data;
    } else {
      for (const issue of result.error.issues) {
        details.push({ location: part, field: issue.path.join('.'), message: issue.message });
      }
    }
  }

  if (details.length) return next(ApiError.badRequest('Validation failed', details));
  next();
};

module.exports = validate;
