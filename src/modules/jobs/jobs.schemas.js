const { z, text, optionalText, nullableText, nullableUrl, id, idParam, pagination } = require('../../utils/validators');

const jobTypeEnum = z.enum(['FULL_TIME', 'INTERNSHIP', 'CONTRACT']);
const jobStatusEnum = z.enum(['OPEN', 'CLOSED', 'REMOVED']);
const applicationStatusEnum = z.enum(['APPLIED', 'SHORTLISTED', 'REJECTED', 'HIRED']);

const emptyToNull = (v) => (v === '' ? null : v);
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');
const nullableDateString = z.preprocess(emptyToNull, dateString.nullable().optional());

const create = z.object({
  title: text(150),
  companyName: text(150),
  location: text(100),
  jobType: jobTypeEnum,
  description: text(10000),
  applyBy: nullableDateString,
});

const update = z
  .object({
    title: text(150).optional(),
    companyName: text(150).optional(),
    location: text(100).optional(),
    jobType: jobTypeEnum.optional(),
    description: text(10000).optional(),
    applyBy: nullableDateString,
    status: jobStatusEnum.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

const listQuery = z.object({
  type: jobTypeEnum.optional(),
  location: optionalText(100),
  status: jobStatusEnum.optional(),
  q: optionalText(100),
  ...pagination,
});

const apply = z.object({
  resumeUrl: nullableUrl,
  coverNote: nullableText(2000),
});

const updateApplicationStatus = z.object({
  status: applicationStatusEnum,
});

module.exports = {
  jobTypeEnum,
  jobStatusEnum,
  applicationStatusEnum,
  create,
  update,
  listQuery,
  apply,
  updateApplicationStatus,
  idParam,
};
