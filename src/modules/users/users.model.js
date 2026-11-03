const { query } = require('../../db/pool');
const { buildSet, likePattern } = require('../../utils/sql');
const { toLimitOffset } = require('../../utils/pagination');

const MAX_FAILED_LOGINS = 5;

const USER_COLUMNS = {
  fullName: 'full_name',
  phone: 'phone',
  emailVerified: 'email_verified',
};

const ALUMNI_COLUMNS = {
  deptId: 'dept_id',
  enrollmentNo: 'enrollment_no',
  degree: 'degree',
  graduationYear: 'graduation_year',
  currentCompany: 'current_company',
  designation: 'designation',
  industry: 'industry',
  city: 'city',
  country: 'country',
  bio: 'bio',
  linkedinUrl: 'linkedin_url',
  photoUrl: 'photo_url',
};

const STUDENT_COLUMNS = {
  deptId: 'dept_id',
  enrollmentNo: 'enrollment_no',
  currentSemester: 'current_semester',
  expectedGradYear: 'expected_grad_year',
};

async function findByEmail(email) {
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
  return rows[0];
}

async function findById(userId) {
  const { rows } = await query('SELECT * FROM users WHERE user_id = $1', [userId]);
  return rows[0];
}

async function createUser(db, { email, passwordHash, fullName, role, phone = null }) {
  const client = db || { query };
  const { rows } = await client.query(
    `INSERT INTO users (email, password_hash, full_name, role, phone)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING user_id`,
    [email.toLowerCase().trim(), passwordHash, fullName.trim(), role, phone]
  );
  return rows[0].user_id;
}

async function updateUser(db, userId, fields) {
  const client = db || { query };
  const { sql, values } = buildSet(fields, USER_COLUMNS, 2);
  if (!sql) return;
  await client.query(`UPDATE users SET ${sql} WHERE user_id = $1`, [userId, ...values]);
}

async function updatePassword(userId, passwordHash) {
  await query('UPDATE users SET password_hash = $2 WHERE user_id = $1', [userId, passwordHash]);
}

async function recordLoginSuccess(userId) {
  await query('UPDATE users SET failed_login_count = 0, last_login_at = NOW() WHERE user_id = $1', [userId]);
}

async function recordLoginFailure(userId) {
  const { rows } = await query(
    `UPDATE users
        SET failed_login_count = failed_login_count + 1,
            account_status = CASE WHEN failed_login_count + 1 >= $2 THEN 'SUSPENDED' ELSE account_status END
      WHERE user_id = $1
      RETURNING failed_login_count, account_status`,
    [userId, MAX_FAILED_LOGINS]
  );
  return rows[0];
}

async function setAccountStatus(userId, status) {
  const { rows } = await query(
    `UPDATE users
        SET account_status = $2::varchar,
            failed_login_count = CASE WHEN $2::varchar = 'ACTIVE' THEN 0 ELSE failed_login_count END
      WHERE user_id = $1
      RETURNING user_id AS "userId", account_status AS "accountStatus"`,
    [userId, status]
  );
  return rows[0];
}

async function countsByRole() {
  const { rows } = await query(
    `SELECT role, account_status AS "accountStatus", COUNT(*)::int AS count
       FROM users
      GROUP BY role, account_status`
  );
  return rows;
}

async function createAlumniProfile(db, userId, fields) {
  const client = db || { query };
  await client.query(
    `INSERT INTO alumni_profile (user_id, dept_id, enrollment_no, degree, graduation_year,
                                 current_company, designation, industry, city, country, bio, linkedin_url, photo_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      userId,
      fields.deptId,
      fields.enrollmentNo,
      fields.degree,
      fields.graduationYear,
      fields.currentCompany ?? null,
      fields.designation ?? null,
      fields.industry ?? null,
      fields.city ?? null,
      fields.country ?? null,
      fields.bio ?? null,
      fields.linkedinUrl ?? null,
      fields.photoUrl ?? null,
    ]
  );
}

async function createStudentProfile(db, userId, fields) {
  const client = db || { query };
  await client.query(
    `INSERT INTO student_profile (user_id, dept_id, enrollment_no, current_semester, expected_grad_year)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, fields.deptId, fields.enrollmentNo, fields.currentSemester, fields.expectedGradYear]
  );
}

async function updateAlumniProfile(db, userId, fields) {
  const client = db || { query };
  const { sql, values } = buildSet(fields, ALUMNI_COLUMNS, 2);
  if (!sql) return;
  await client.query(`UPDATE alumni_profile SET ${sql} WHERE user_id = $1`, [userId, ...values]);
}

async function updateStudentProfile(db, userId, fields) {
  const client = db || { query };
  const { sql, values } = buildSet(fields, STUDENT_COLUMNS, 2);
  if (!sql) return;
  await client.query(`UPDATE student_profile SET ${sql} WHERE user_id = $1`, [userId, ...values]);
}

async function setVerification(alumniId, status, adminId, db = { query }) {
  const client = db || { query };
  const { rows } = await client.query(
    `UPDATE alumni_profile
        SET verification_status = $2,
            verified_by = $3,
            verified_at = NOW()
      WHERE user_id = $1
      RETURNING user_id AS "userId", verification_status AS "verificationStatus",
                verified_by AS "verifiedBy", verified_at AS "verifiedAt"`,
    [alumniId, status, adminId]
  );
  return rows[0];
}

async function setTags(db, type, userId, tagNames) {
  const client = db || { query };
  const isSkill = type === 'skills';
  const table = isSkill ? 'skill' : 'interest';
  const userTable = isSkill ? 'user_skill' : 'user_interest';
  const idCol = isSkill ? 'skill_id' : 'interest_id';
  const nameCol = isSkill ? 'skill_name' : 'interest_name';

  await client.query(`DELETE FROM ${userTable} WHERE user_id = $1`, [userId]);

  if (!tagNames || !tagNames.length) return;

  // De-duplicate case-insensitively, keeping the first spelling the user typed.
  const seen = new Set();
  for (const rawName of tagNames) {
    const cleanName = rawName.trim();
    if (!cleanName || seen.has(cleanName.toLowerCase())) continue;
    seen.add(cleanName.toLowerCase());
    // The no-op update keeps an existing skill's spelling and still returns its id.
    const { rows } = await client.query(
      `INSERT INTO ${table} (${nameCol}) VALUES ($1)
       ON CONFLICT (LOWER(${nameCol})) DO UPDATE SET ${nameCol} = ${table}.${nameCol}
       RETURNING ${idCol}`,
      [cleanName]
    );
    const tagId = rows[0][idCol];
    await client.query(
      `INSERT INTO ${userTable} (user_id, ${idCol}) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, tagId]
    );
  }
}

async function listTags(type, search = null) {
  const isSkill = type === 'skills';
  const table = isSkill ? 'skill' : 'interest';
  const userTable = isSkill ? 'user_skill' : 'user_interest';
  const idCol = isSkill ? 'skill_id' : 'interest_id';
  const nameCol = isSkill ? 'skill_name' : 'interest_name';
  const alias = isSkill ? 'skillName' : 'interestName';

  const values = [];
  let filter = '';
  if (search) {
    values.push(likePattern(search));
    filter = `WHERE t.${nameCol} ILIKE $1`;
  }

  const { rows } = await query(
    `SELECT t.${idCol} AS "${isSkill ? 'skillId' : 'interestId'}",
            t.${nameCol} AS "${alias}",
            COUNT(ut.user_id)::int AS count
       FROM ${table} t
       LEFT JOIN ${userTable} ut ON ut.${idCol} = t.${idCol}
      ${filter}
      GROUP BY t.${idCol}
      ORDER BY count DESC, LOWER(t.${nameCol}) ASC`,
    values
  );
  return rows;
}

async function getFullProfile(userId) {
  const { rows } = await query(
    `SELECT u.user_id AS "userId", u.email, u.full_name AS "fullName", u.phone, u.role,
            u.account_status AS "accountStatus", u.created_at AS "createdAt", u.last_login_at AS "lastLoginAt",
            COALESCE(ap.dept_id, sp.dept_id) AS "deptId",
            d.dept_code AS "deptCode", d.dept_name AS "deptName",
            COALESCE(ap.enrollment_no, sp.enrollment_no) AS "enrollmentNo",
            ap.degree, ap.graduation_year AS "graduationYear", ap.current_company AS "currentCompany",
            ap.designation, ap.industry, ap.city, ap.country, ap.bio,
            ap.linkedin_url AS "linkedinUrl", ap.photo_url AS "photoUrl",
            ap.verification_status AS "verificationStatus", ap.verified_at AS "verifiedAt",
            sp.current_semester AS "currentSemester", sp.expected_grad_year AS "expectedGradYear",
            ARRAY(SELECT s.skill_name FROM user_skill us JOIN skill s ON s.skill_id = us.skill_id
                   WHERE us.user_id = u.user_id ORDER BY LOWER(s.skill_name)) AS skills,
            ARRAY(SELECT i.interest_name FROM user_interest ui JOIN interest i ON i.interest_id = ui.interest_id
                   WHERE ui.user_id = u.user_id ORDER BY LOWER(i.interest_name)) AS interests
       FROM users u
       LEFT JOIN alumni_profile ap ON ap.user_id = u.user_id
       LEFT JOIN student_profile sp ON sp.user_id = u.user_id
       LEFT JOIN department d ON d.dept_id = COALESCE(ap.dept_id, sp.dept_id)
      WHERE u.user_id = $1`,
    [userId]
  );
  return rows[0];
}

async function listUsers({ page = 1, limit = 20, role, accountStatus, q } = {}) {
  const conditions = [];
  const values = [];

  if (role) {
    values.push(role);
    conditions.push(`u.role = $${values.length}`);
  }
  if (accountStatus) {
    values.push(accountStatus);
    conditions.push(`u.account_status = $${values.length}`);
  }
  if (q) {
    values.push(likePattern(q));
    conditions.push(`(u.full_name ILIKE $${values.length} OR u.email ILIKE $${values.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows: countRows } = await query(`SELECT COUNT(*)::int AS total FROM users u ${where}`, values);
  const total = countRows[0].total;

  const { limit: lim, offset } = toLimitOffset({ page, limit });
  values.push(lim, offset);

  const { rows } = await query(
    `SELECT u.user_id AS "userId", u.email, u.full_name AS "fullName", u.phone, u.role,
            u.account_status AS "accountStatus", u.created_at AS "createdAt", u.last_login_at AS "lastLoginAt",
            COALESCE(ap.dept_id, sp.dept_id) AS "deptId",
            d.dept_code AS "deptCode", d.dept_name AS "deptName",
            ap.verification_status AS "verificationStatus"
       FROM users u
       LEFT JOIN alumni_profile ap ON ap.user_id = u.user_id
       LEFT JOIN student_profile sp ON sp.user_id = u.user_id
       LEFT JOIN department d ON d.dept_id = COALESCE(ap.dept_id, sp.dept_id)
      ${where}
      ORDER BY u.created_at DESC, u.user_id DESC
      LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return { rows, total };
}

module.exports = {
  MAX_FAILED_LOGINS,
  findByEmail,
  findById,
  createUser,
  updateUser,
  updatePassword,
  recordLoginSuccess,
  recordLoginFailure,
  setAccountStatus,
  countsByRole,
  createAlumniProfile,
  createStudentProfile,
  updateAlumniProfile,
  updateStudentProfile,
  setVerification,
  setTags,
  listTags,
  getFullProfile,
  listUsers,
};
