const { z, optionalText, idParam, pagination } = require('../../utils/validators');

const verification = z.object({
  status: z.enum(['VERIFIED', 'REJECTED']),
  note: z.string().trim().max(500).optional(),
});

const accountStatus = z.object({
  accountStatus: z.enum(['ACTIVE', 'SUSPENDED']),
});

const auditQuery = z.object({
  action: optionalText(60).transform((v) => v?.toUpperCase()),
  outcome: z.enum(['SUCCESS', 'FAILURE']).optional(),
  ...pagination,
});

const usersQuery = z.object({
  role: z.enum(['ADMIN', 'ALUMNI', 'STUDENT']).optional(),
  accountStatus: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED']).optional(),
  q: optionalText(100),
  ...pagination,
});

module.exports = { verification, accountStatus, auditQuery, usersQuery, idParam };
