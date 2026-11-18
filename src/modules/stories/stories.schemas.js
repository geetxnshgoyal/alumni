const { z } = require('zod');

const createStorySchema = z.object({
  title: z.string().trim().min(5, 'Title must be at least 5 characters').max(200, 'Title cannot exceed 200 characters'),
  body: z.string().trim().min(20, 'Story body must be at least 20 characters'),
  category: z.enum(['CAREER', 'STARTUP', 'RESEARCH', 'LEADERSHIP', 'INNOVATION', 'COMMUNITY', 'OTHER']).default('CAREER'),
  mediaUrl: z.string().url('Media URL must be a valid URL').max(500).optional().nullable()
});

const updateStorySchema = z.object({
  title: z.string().trim().min(5).max(200).optional(),
  body: z.string().trim().min(20).optional(),
  category: z.enum(['CAREER', 'STARTUP', 'RESEARCH', 'LEADERSHIP', 'INNOVATION', 'COMMUNITY', 'OTHER']).optional(),
  mediaUrl: z.string().url().max(500).optional().nullable()
});

const reviewStorySchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED'], {
    errorMap: () => ({ message: 'Review status must be either APPROVED or REJECTED' })
  }),
  reviewNote: z.string().trim().max(1000).optional().nullable()
});

const listStoriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  category: z.string().trim().optional(),
  search: z.string().trim().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional()
});

module.exports = {
  createStorySchema,
  updateStorySchema,
  reviewStorySchema,
  listStoriesQuerySchema
};
