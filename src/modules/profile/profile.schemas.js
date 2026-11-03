const { z, text, optionalText, nullableText, nullableUrl, phone, tagList } = require('../../utils/validators');

const updateProfile = z
  .object({
    phone,
    // Alumni fields
    degree: optionalText(80),
    graduationYear: z.coerce.number().int().min(1950).max(2100).optional(),
    currentCompany: nullableText(120),
    designation: nullableText(120),
    industry: nullableText(80),
    city: nullableText(80),
    country: nullableText(80),
    bio: nullableText(2000),
    linkedinUrl: nullableUrl,
    photoUrl: nullableUrl,
    // Student fields
    currentSemester: z.coerce.number().int().min(1).max(12).optional(),
    expectedGradYear: z.coerce.number().int().min(1950).max(2100).optional(),
    // Tags
    skills: tagList,
    interests: tagList,
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update' });

const searchTags = z.object({
  q: optionalText(60),
});

module.exports = { updateProfile, searchTags };
