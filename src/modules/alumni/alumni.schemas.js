const { z, optionalText, optionalInt, id, idParam, pagination } = require('../../utils/validators');

const currentYear = new Date().getFullYear();

const search = z
  .object({
    q: optionalText(100),
    graduationYear: optionalInt(1950, currentYear),
    yearFrom: optionalInt(1950, currentYear),
    yearTo: optionalInt(1950, currentYear),
    deptId: z.preprocess((v) => (v === '' ? undefined : v), id.optional()),
    industry: optionalText(80),
    city: optionalText(80),
    country: optionalText(80),
    company: optionalText(120),
    skill: optionalText(60),
    interest: optionalText(60),
    // Only admins may look at PENDING / REJECTED alumni; others always see VERIFIED.
    status: z.enum(['PENDING', 'VERIFIED', 'REJECTED']).optional(),
    sort: z.enum(['name', 'graduationYear', 'recent']).default('name'),
    ...pagination,
  })
  .refine((v) => !v.yearFrom || !v.yearTo || v.yearFrom <= v.yearTo, {
    message: 'yearFrom must be less than or equal to yearTo',
    path: ['yearFrom'],
  });

module.exports = { search, idParam };
