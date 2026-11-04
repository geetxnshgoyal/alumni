const { z, nullableText, id, idParam, pagination } = require('../../utils/validators');

const connectionTypeEnum = z.enum(['NETWORK', 'MENTORSHIP']);
const connectionStatusEnum = z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'BLOCKED']);

const create = z.object({
  receiverId: id,
  connectionType: connectionTypeEnum.default('NETWORK'),
  requestNote: nullableText(500),
});

const updateStatus = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED', 'BLOCKED']),
});

const listQuery = z.object({
  status: connectionStatusEnum.optional(),
  type: connectionTypeEnum.optional(),
  ...pagination,
});

module.exports = {
  connectionTypeEnum,
  connectionStatusEnum,
  create,
  updateStatus,
  listQuery,
  idParam,
};
