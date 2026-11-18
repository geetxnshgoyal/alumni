const { z } = require('zod');

const feedbackCategoryEnum = z.enum(['PLATFORM', 'ACADEMIC', 'EVENT', 'CAREER', 'GENERAL']);
const feedbackStatusEnum = z.enum(['OPEN', 'IN_REVIEW', 'CLOSED']);

const createFeedbackSchema = z.object({
  category: feedbackCategoryEnum.default('GENERAL'),
  message: z.string().trim().min(5, 'Message must be at least 5 characters').max(2000, 'Message cannot exceed 2000 characters')
});

const adminUpdateFeedbackSchema = z.object({
  status: feedbackStatusEnum,
  adminResponse: z.string().trim().max(2000).optional().nullable()
});

const listFeedbackQuerySchema = z.object({
  status: feedbackStatusEnum.optional(),
  category: feedbackCategoryEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

module.exports = {
  createFeedbackSchema,
  adminUpdateFeedbackSchema,
  listFeedbackQuerySchema
};
