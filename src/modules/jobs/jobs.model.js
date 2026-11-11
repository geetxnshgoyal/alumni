const { query } = require('../../db/pool');
const { toLimitOffset } = require('../../utils/pagination');
const { likePattern } = require('../../utils/sql');

const JOB_COLUMNS = `
  j.job_id AS "jobId",
  j.posted_by AS "postedBy",
  j.title,
  j.company_name AS "companyName",
  j.location,
  j.job_type AS "jobType",
  j.description,
  TO_CHAR(j.apply_by, 'YYYY-MM-DD') AS "applyBy",
  j.status,
  j.created_at AS "createdAt",
  u.full_name AS "posterName",
  u.email AS "posterEmail",
  u.role AS "posterRole"
`;

const APPLICATION_COLUMNS = `
  ja.application_id AS "applicationId",
  ja.job_id AS "jobId",
  ja.applicant_id AS "applicantId",
  ja.resume_url AS "resumeUrl",
  ja.cover_note AS "coverNote",
  ja.status,
  ja.applied_at AS "appliedAt",
  u.full_name AS "applicantName",
  u.email AS "applicantEmail",
  j.title AS "jobTitle",
  j.company_name AS "companyName",
  j.posted_by AS "postedBy"
`;

// Creates a new job posting.
async function create({ postedBy, title, companyName, location, jobType, description, applyBy = null }, db = { query }) {
  const { rows } = await db.query(
    `INSERT INTO job_post (posted_by, title, company_name, location, job_type, description, apply_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING job_id AS "jobId", posted_by AS "postedBy", title, company_name AS "companyName",
               location, job_type AS "jobType", description, TO_CHAR(apply_by, 'YYYY-MM-DD') AS "applyBy",
               status, created_at AS "createdAt"`,
    [postedBy, title, companyName, location, jobType, description, applyBy]
  );
  return rows[0];
}

// Finds a single job post by ID with poster details.
async function findById(jobId, db = { query }) {
  const { rows } = await db.query(
    `SELECT ${JOB_COLUMNS}
       FROM job_post j
       JOIN users u ON u.user_id = j.posted_by
      WHERE j.job_id = $1`,
    [jobId]
  );
  return rows[0];
}

// Lists jobs with filtering and pagination.
async function list({ type, location, status, q, page = 1, limit = 20 } = {}, db = { query }) {
  const conditions = [];
  const values = [];

  if (type) {
    values.push(type);
    conditions.push(`j.job_type = $${values.length}`);
  }

  if (location) {
    values.push(likePattern(location));
    conditions.push(`j.location ILIKE $${values.length}`);
  }

  if (status) {
    values.push(status);
    conditions.push(`j.status = $${values.length}`);
  }

  if (q) {
    values.push(likePattern(q));
    conditions.push(`(j.title ILIKE $${values.length} OR j.company_name ILIKE $${values.length} OR j.description ILIKE $${values.length})`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*)::int AS total FROM job_post j ${whereClause}`,
    values
  );
  const total = countRows[0]?.total || 0;

  const { limit: lim, offset } = toLimitOffset({ page, limit });
  const pagingValues = [...values, lim, offset];

  const { rows } = await db.query(
    `SELECT ${JOB_COLUMNS}
       FROM job_post j
       JOIN users u ON u.user_id = j.posted_by
      ${whereClause}
      ORDER BY j.created_at DESC, j.job_id DESC
      LIMIT $${pagingValues.length - 1} OFFSET $${pagingValues.length}`,
    pagingValues
  );

  return { rows, total };
}

// Updates fields of a job post.
async function update(jobId, fields, db = { query }) {
  const map = {
    title: 'title',
    companyName: 'company_name',
    location: 'location',
    jobType: 'job_type',
    description: 'description',
    applyBy: 'apply_by',
    status: 'status',
  };

  const sets = [];
  const values = [jobId];

  for (const [key, col] of Object.entries(map)) {
    if (fields[key] !== undefined) {
      values.push(fields[key]);
      sets.push(`${col} = $${values.length}`);
    }
  }

  if (!sets.length) return findById(jobId, db);

  await db.query(
    `UPDATE job_post
        SET ${sets.join(', ')}
      WHERE job_id = $1`,
    values
  );

  return findById(jobId, db);
}

// Updates the status of a job post (e.g. 'CLOSED').
async function updateStatus(jobId, status, db = { query }) {
  await db.query(
    `UPDATE job_post
        SET status = $2
      WHERE job_id = $1`,
    [jobId, status]
  );
  return findById(jobId, db);
}

// Submits a job application.
async function apply({ jobId, applicantId, resumeUrl = null, coverNote = null }, db = { query }) {
  const { rows } = await db.query(
    `INSERT INTO job_application (job_id, applicant_id, resume_url, cover_note)
     VALUES ($1, $2, $3, $4)
     RETURNING application_id AS "applicationId", job_id AS "jobId",
               applicant_id AS "applicantId", resume_url AS "resumeUrl",
               cover_note AS "coverNote", status, applied_at AS "appliedAt"`,
    [jobId, applicantId, resumeUrl, coverNote]
  );
  return rows[0];
}

// Finds an existing application between a user and a job.
async function findApplication(jobId, applicantId, db = { query }) {
  const { rows } = await db.query(
    `SELECT ${APPLICATION_COLUMNS}
       FROM job_application ja
       JOIN users u ON u.user_id = ja.applicant_id
       JOIN job_post j ON j.job_id = ja.job_id
      WHERE ja.job_id = $1 AND ja.applicant_id = $2`,
    [jobId, applicantId]
  );
  return rows[0];
}

// Finds an application by its ID.
async function findApplicationById(applicationId, db = { query }) {
  const { rows } = await db.query(
    `SELECT ${APPLICATION_COLUMNS}
       FROM job_application ja
       JOIN users u ON u.user_id = ja.applicant_id
       JOIN job_post j ON j.job_id = ja.job_id
      WHERE ja.application_id = $1`,
    [applicationId]
  );
  return rows[0];
}

// Lists applications for a specific job post.
async function listApplicationsForJob(jobId, { page = 1, limit = 20 } = {}, db = { query }) {
  const { rows: countRows } = await db.query(
    'SELECT COUNT(*)::int AS total FROM job_application WHERE job_id = $1',
    [jobId]
  );
  const total = countRows[0]?.total || 0;

  const { limit: lim, offset } = toLimitOffset({ page, limit });

  const { rows } = await db.query(
    `SELECT ${APPLICATION_COLUMNS}
       FROM job_application ja
       JOIN users u ON u.user_id = ja.applicant_id
       JOIN job_post j ON j.job_id = ja.job_id
      WHERE ja.job_id = $1
      ORDER BY ja.applied_at DESC, ja.application_id DESC
      LIMIT $2 OFFSET $3`,
    [jobId, lim, offset]
  );

  return { rows, total };
}

// Lists applications submitted by a user.
async function listApplicationsForUser(applicantId, { page = 1, limit = 20 } = {}, db = { query }) {
  const { rows: countRows } = await db.query(
    'SELECT COUNT(*)::int AS total FROM job_application WHERE applicant_id = $1',
    [applicantId]
  );
  const total = countRows[0]?.total || 0;

  const { limit: lim, offset } = toLimitOffset({ page, limit });

  const { rows } = await db.query(
    `SELECT ${APPLICATION_COLUMNS}
       FROM job_application ja
       JOIN users u ON u.user_id = ja.applicant_id
       JOIN job_post j ON j.job_id = ja.job_id
      WHERE ja.applicant_id = $1
      ORDER BY ja.applied_at DESC, ja.application_id DESC
      LIMIT $2 OFFSET $3`,
    [applicantId, lim, offset]
  );

  return { rows, total };
}

// Updates the status of an application.
async function updateApplicationStatus(applicationId, status, db = { query }) {
  const { rows } = await db.query(
    `UPDATE job_application
        SET status = $2
      WHERE application_id = $1
      RETURNING application_id AS "applicationId", job_id AS "jobId",
                applicant_id AS "applicantId", resume_url AS "resumeUrl",
                cover_note AS "coverNote", status, applied_at AS "appliedAt"`,
    [applicationId, status]
  );
  return rows[0];
}

module.exports = {
  create,
  findById,
  list,
  update,
  updateStatus,
  apply,
  findApplication,
  findApplicationById,
  listApplicationsForJob,
  listApplicationsForUser,
  updateApplicationStatus,
};
