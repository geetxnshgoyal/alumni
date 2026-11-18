const { z, text, optionalText, id, idParam, pagination } = require('../../utils/validators');

const eventTypeEnum = z.enum(['REUNION', 'WORKSHOP', 'WEBINAR']);
const eventModeEnum = z.enum(['ONLINE', 'OFFLINE']);
const eventStatusEnum = z.enum(['DRAFT', 'OPEN', 'COMPLETED', 'CANCELLED']);
const regStatusEnum = z.enum(['REGISTERED', 'WAITLISTED', 'CANCELLED']);

const dateTimeString = z.string().trim().refine((val) => !isNaN(Date.parse(val)), {
  message: 'Must be a valid date/time format (e.g. YYYY-MM-DD or ISO 8601 string)',
});

const emptyToNull = (v) => (v === '' ? null : v);
const nullableDateTimeString = z.preprocess(emptyToNull, dateTimeString.nullable().optional());

const create = z
  .object({
    title: text(150),
    description: text(10000),
    eventType: eventTypeEnum,
    mode: eventModeEnum,
    venueOrLink: text(255),
    startAt: dateTimeString,
    endAt: dateTimeString,
    capacity: z.coerce.number().int().positive('Capacity must be a positive integer'),
    registrationDeadline: nullableDateTimeString,
    status: eventStatusEnum.optional().default('DRAFT'),
  })
  .refine((data) => new Date(data.endAt) > new Date(data.startAt), {
    message: 'End date must be after start date',
    path: ['endAt'],
  })
  .refine(
    (data) => !data.registrationDeadline || new Date(data.registrationDeadline) <= new Date(data.startAt),
    {
      message: 'Registration deadline must be on or before event start date',
      path: ['registrationDeadline'],
    }
  );

const update = z
  .object({
    title: text(150).optional(),
    description: text(10000).optional(),
    eventType: eventTypeEnum.optional(),
    mode: eventModeEnum.optional(),
    venueOrLink: text(255).optional(),
    startAt: dateTimeString.optional(),
    endAt: dateTimeString.optional(),
    capacity: z.coerce.number().int().positive().optional(),
    registrationDeadline: nullableDateTimeString,
    status: eventStatusEnum.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  })
  .refine(
    (data) => {
      if (data.startAt && data.endAt) {
        return new Date(data.endAt) > new Date(data.startAt);
      }
      return true;
    },
    {
      message: 'End date must be after start date',
      path: ['endAt'],
    }
  )
  .refine(
    (data) => {
      if (data.registrationDeadline && data.startAt) {
        return new Date(data.registrationDeadline) <= new Date(data.startAt);
      }
      return true;
    },
    {
      message: 'Registration deadline must be on or before event start date',
      path: ['registrationDeadline'],
    }
  );

const listQuery = z.object({
  type: eventTypeEnum.optional(),
  mode: eventModeEnum.optional(),
  status: eventStatusEnum.optional(),
  q: optionalText(100),
  ...pagination,
});

module.exports = {
  eventTypeEnum,
  eventModeEnum,
  eventStatusEnum,
  regStatusEnum,
  create,
  update,
  listQuery,
  idParam,
};
