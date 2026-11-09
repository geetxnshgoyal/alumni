const { z, text, id, pagination } = require('../../utils/validators');

const create = z.object({
  connectionId: id,
  content: text(5000),
});

const listQuery = z.object({
  connectionId: id,
  ...pagination,
});

module.exports = {
  create,
  listQuery,
};
