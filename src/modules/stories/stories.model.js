const { query } = require('../../db/pool');
const { toLimitOffset } = require('../../utils/pagination');

const STORY_COLUMNS = `
  s.story_id AS "storyId",
  s.author_id AS "authorId",
  s.title,
  s.body,
  s.category,
  s.media_url AS "mediaUrl",
  s.status,
  s.reviewed_by AS "reviewedBy",
  s.reviewed_at AS "reviewedAt",
  s.review_note AS "reviewNote",
  s.created_at AS "createdAt",
  s.updated_at AS "updatedAt",
  u.full_name AS "authorName",
  u.email AS "authorEmail",
  ap.designation AS "authorDesignation",
  ap.current_company AS "authorCompany",
  d.dept_code AS "authorDeptCode",
  d.dept_name AS "authorDeptName",
  ap.graduation_year AS "authorGraduationYear"
`;

async function createStory(story, db = { query }) {
  const { authorId, title, body, category = 'CAREER', mediaUrl = null, status = 'SUBMITTED' } = story;
  const { rows } = await db.query(
    `INSERT INTO success_story (author_id, title, body, category, media_url, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING story_id AS "storyId", author_id AS "authorId", title, body, category,
               media_url AS "mediaUrl", status, created_at AS "createdAt"`,
    [authorId, title, body, category, mediaUrl, status]
  );
  return rows[0];
}

async function findStoryById(storyId, db = { query }) {
  const { rows } = await db.query(
    `SELECT ${STORY_COLUMNS}
     FROM success_story s
     JOIN users u ON u.user_id = s.author_id
     LEFT JOIN alumni_profile ap ON ap.user_id = s.author_id
     LEFT JOIN department d ON d.dept_id = ap.dept_id
     WHERE s.story_id = $1`,
    [storyId]
  );
  return rows[0] || null;
}

async function listStories({ status, category, search, authorId, page = 1, limit = 12 } = {}, db = { query }) {
  const conditions = [];
  const values = [];

  if (status) {
    values.push(status);
    conditions.push(`s.status = $${values.length}`);
  }

  if (category) {
    values.push(category);
    conditions.push(`s.category = $${values.length}`);
  }

  if (authorId) {
    values.push(authorId);
    conditions.push(`s.author_id = $${values.length}`);
  }

  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(s.title ILIKE $${values.length} OR s.body ILIKE $${values.length} OR u.full_name ILIKE $${values.length})`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM success_story s
     JOIN users u ON u.user_id = s.author_id
     ${whereClause}`,
    values
  );
  const total = countRows[0]?.total || 0;

  const { limit: lim, offset } = toLimitOffset({ page, limit });
  values.push(lim, offset);

  const { rows } = await db.query(
    `SELECT ${STORY_COLUMNS}
     FROM success_story s
     JOIN users u ON u.user_id = s.author_id
     LEFT JOIN alumni_profile ap ON ap.user_id = s.author_id
     LEFT JOIN department d ON d.dept_id = ap.dept_id
     ${whereClause}
     ORDER BY s.created_at DESC, s.story_id DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return { rows, total };
}

async function updateStory(storyId, data, db = { query }) {
  const fields = [];
  const values = [storyId];

  if (data.title !== undefined) {
    values.push(data.title);
    fields.push(`title = $${values.length}`);
  }
  if (data.body !== undefined) {
    values.push(data.body);
    fields.push(`body = $${values.length}`);
  }
  if (data.category !== undefined) {
    values.push(data.category);
    fields.push(`category = $${values.length}`);
  }
  if (data.mediaUrl !== undefined) {
    values.push(data.mediaUrl);
    fields.push(`media_url = $${values.length}`);
  }
  if (data.status !== undefined) {
    values.push(data.status);
    fields.push(`status = $${values.length}`);
  }

  fields.push('updated_at = NOW()');

  const { rows } = await db.query(
    `UPDATE success_story
     SET ${fields.join(', ')}
     WHERE story_id = $1
     RETURNING story_id AS "storyId", title, status, updated_at AS "updatedAt"`,
    values
  );
  return rows[0] || null;
}

async function reviewStory(storyId, { status, reviewedBy, reviewNote = null }, db = { query }) {
  const { rows } = await db.query(
    `UPDATE success_story
     SET status = $2, reviewed_by = $3, review_note = $4, reviewed_at = NOW(), updated_at = NOW()
     WHERE story_id = $1
     RETURNING story_id AS "storyId", author_id AS "authorId", title, status,
               reviewed_by AS "reviewedBy", review_note AS "reviewNote", reviewed_at AS "reviewedAt"`,
    [storyId, status, reviewedBy, reviewNote]
  );
  return rows[0] || null;
}

async function deleteStory(storyId, db = { query }) {
  const { rowCount } = await db.query('DELETE FROM success_story WHERE story_id = $1', [storyId]);
  return rowCount > 0;
}

module.exports = {
  createStory,
  findStoryById,
  listStories,
  updateStory,
  reviewStory,
  deleteStory
};
