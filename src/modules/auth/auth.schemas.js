const { z, text, nullableText, nullableUrl, id, email, password, phone, tagList } = require('../../utils/validators');

const currentYear = new Date().getFullYear();

const common = {
  email,
  password,
  fullName: text(120, 2),
  phone,
  deptId: id,
  enrollmentNo: text(30),
  skills: tagList,
  interests: tagList,
};

const alumniRegistration = z.object({
  ...common,
  role: z.literal('ALUMNI'),
  degree: text(80),
  graduationYear: z.coerce.number().int().min(1950).max(currentYear),
  currentCompany: nullableText(120),
  designation: nullableText(120),
  industry: nullableText(80),
  city: nullableText(80),
  country: nullableText(80),
  bio: nullableText(2000),
  linkedinUrl: nullableUrl,
  photoUrl: nullableUrl,
});

const studentRegistration = z.object({
  ...common,
  role: z.literal('STUDENT'),
  currentSemester: z.coerce.number().int().min(1).max(12),
  expectedGradYear: z.coerce.number().int().min(currentYear - 1).max(currentYear + 8),
});

// Admin accounts cannot self-register; they are created by the seed script.
const register = z.discriminatedUnion('role', [alumniRegistration, studentRegistration], {
  error: 'role must be ALUMNI or STUDENT',
});

const login = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

const changePassword = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: password,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'New password must be different from the current password',
    path: ['newPassword'],
  });

module.exports = { register, login, changePassword };
