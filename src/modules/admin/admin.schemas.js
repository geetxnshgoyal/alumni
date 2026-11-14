const { z, optionalText, idParam, pagination } = require('../../utils/validators');

const verification = z.object({
  status: z.enum(['VERIFIED', 'REJECTED']),
  note: z.string().trim().max(500).optional(),
});

const accountStatus = z.object({
  accountStatus: z.enum(['ACTIVE', 'SUSPENDED']),
});

const auditQuery = z
  .object({
    action: optionalText(60).transform((v) => v?.toUpperCase()),
    outcome: z.enum(['SUCCESS', 'FAILURE']).optional(),
    from: z.iso.date().optional(), // YYYY-MM-DD, inclusive
    to: z.iso.date().optional(), // YYYY-MM-DD, inclusive
    ...pagination,
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: 'from must be on or before to', path: ['from'] });

const usersQuery = z.object({
  role: z.enum(['ADMIN', 'ALUMNI', 'STUDENT']).optional(),
  accountStatus: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED']).optional(),
  q: optionalText(100),
  ...pagination,
});

module.exports = { verification, accountStatus, auditQuery, usersQuery, idParam };
