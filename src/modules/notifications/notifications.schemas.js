const { z, idParam, pagination } = require('../../utils/validators');

const listQuery = z.object({
  unreadOnly: z.preprocess((v) => v === 'true' || v === true, z.boolean().optional()),
  ...pagination,
});

module.exports = { listQuery, idParam };
