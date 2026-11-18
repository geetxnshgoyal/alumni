const { z } = require('zod');

const questionTypeEnum = z.enum(['TEXT', 'SINGLE_CHOICE', 'MULTI_CHOICE', 'RATING']);

const createQuestionSchema = z.object({
  questionText: z.string().trim().min(3, 'Question text must be at least 3 characters'),
  questionType: questionTypeEnum,
  isRequired: z.boolean().default(true),
  position: z.number().int().min(1).default(1),
  options: z.array(z.string().trim().min(1)).optional().default([])
});

const createSurveySchema = z.object({
  title: z.string().trim().min(5, 'Title must be at least 5 characters').max(200, 'Title cannot exceed 200 characters'),
  description: z.string().trim().optional().nullable(),
  opensAt: z.string().datetime().optional().nullable(),
  closesAt: z.string().datetime().optional().nullable(),
  status: z.enum(['DRAFT', 'ACTIVE', 'CLOSED']).default('ACTIVE'),
  questions: z.array(createQuestionSchema).min(1, 'Survey must contain at least one question')
});

const submitAnswerSchema = z.object({
  questionId: z.number().int().positive('Question ID must be a positive integer'),
  answerText: z.string().trim().optional().nullable(),
  ratingValue: z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5').optional().nullable(),
  optionIds: z.array(z.number().int().positive()).optional().default([])
});

const submitResponseSchema = z.object({
  answers: z.array(submitAnswerSchema).min(1, 'At least one answer must be provided')
});

const updateSurveyStatusSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'CLOSED'])
});

const listSurveysQuerySchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'CLOSED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10)
});

module.exports = {
  createSurveySchema,
  submitResponseSchema,
  updateSurveyStatusSchema,
  listSurveysQuerySchema
};
