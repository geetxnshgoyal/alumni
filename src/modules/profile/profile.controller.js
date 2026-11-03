const { query, withTransaction } = require('../../db/pool');
const ApiError = require('../../utils/ApiError');
const users = require('../users/users.model');

// GET /api/profile/me
async function getMe(req, res) {
  const profile = await users.getFullProfile(req.user.id);
  if (!profile) throw ApiError.notFound('Profile not found');
  res.json({ data: profile });
}

// PATCH /api/profile/me
async function updateMe(req, res) {
  const body = req.valid.body;
  const user = await users.findById(req.user.id);
  if (!user) throw ApiError.notFound('User not found');

  const studentFields = ['currentSemester', 'expectedGradYear'];
  const alumniFields = ['currentCompany', 'designation', 'industry', 'city', 'country', 'bio', 'linkedinUrl', 'photoUrl', 'graduationYear', 'degree'];

  if (user.role === 'ALUMNI') {
    for (const f of studentFields) {
      if (body[f] !== undefined) {
        throw ApiError.badRequest(`Field '${f}' is not allowed for alumni profiles`);
      }
    }
  } else if (user.role === 'STUDENT') {
    for (const f of alumniFields) {
      if (body[f] !== undefined) {
        throw ApiError.badRequest(`Field '${f}' is not allowed for student profiles`);
      }
    }
  }

  if (body.phone) {
    const { rows } = await query('SELECT user_id FROM users WHERE phone = $1 AND user_id <> $2', [body.phone, req.user.id]);
    if (rows.length > 0) {
      throw ApiError.conflict('Phone number is already in use by another account');
    }
  }

  await withTransaction(async (client) => {
    if (body.phone !== undefined) {
      await users.updateUser(client, req.user.id, { phone: body.phone });
    }
    if (user.role === 'ALUMNI') {
      await users.updateAlumniProfile(client, req.user.id, body);
    } else if (user.role === 'STUDENT') {
      await users.updateStudentProfile(client, req.user.id, body);
    }
    if (body.skills !== undefined) {
      await users.setTags(client, 'skills', req.user.id, body.skills);
    }
    if (body.interests !== undefined) {
      await users.setTags(client, 'interests', req.user.id, body.interests);
    }
  });

  const updated = await users.getFullProfile(req.user.id);
  res.json({ data: updated });
}

// GET /api/skills
async function getSkills(req, res) {
  const q = req.valid?.query?.q;
  const data = await users.listTags('skills', q);
  res.json({ data });
}

// GET /api/interests
async function getInterests(req, res) {
  const q = req.valid?.query?.q;
  const data = await users.listTags('interests', q);
  res.json({ data });
}

module.exports = { getMe, updateMe, getSkills, getInterests };
