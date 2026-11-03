const { z, text, idParam, pagination } = require('../../utils/validators');

const statusEnum = z.enum(['DRAFT', 'ACTIVE', 'CLOSED']);

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

const create = z
  .object({
    title: text(200, 3),
    description: z.string().trim().min(10, 'Description must be at least 10 characters'),
    goalAmount: z.number().positive('Goal amount must be greater than zero'),
    startDate: dateString,
    endDate: dateString,
    status: statusEnum.default('ACTIVE'),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date must be greater than or equal to start date',
    path: ['endDate'],
  });

const update = z
  .object({
    title: text(200, 3).optional(),
    description: z.string().trim().min(10).optional(),
    goalAmount: z.number().positive().optional(),
    startDate: dateString.optional(),
    endDate: dateString.optional(),
    status: statusEnum.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

const listQuery = z.object({
  status: statusEnum.optional(),
  ...pagination,
});

module.exports = {
  create,
  update,
  listQuery,
  idParam,
};
