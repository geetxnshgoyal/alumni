// Alumni directory queries: search with filters, single public profile, filter options.
const { query } = require('../../db/pool');
const { likePattern } = require('../../utils/sql');
const { toLimitOffset } = require('../../utils/pagination');

const SORTS = {
  name: 'LOWER(u.full_name) ASC',
  graduationYear: 'ap.graduation_year DESC, LOWER(u.full_name) ASC',
  recent: 'u.created_at DESC',
};

// Builds the WHERE clause from filters. Every value goes in as a $n parameter.
function buildFilters(f) {
  const where = ["u.account_status = 'ACTIVE'"];
  const values = [];
  const add = (sql, value) => {
    values.push(value);
    where.push(sql.replaceAll('?', `$${values.length}`));
  };

  add('ap.verification_status = ?', f.status ?? 'VERIFIED');
  if (f.q) add('(u.full_name ILIKE ? OR ap.current_company ILIKE ? OR ap.designation ILIKE ?)', likePattern(f.q));
  if (f.graduationYear) add('ap.graduation_year = ?', f.graduationYear);
  if (f.yearFrom) add('ap.graduation_year >= ?', f.yearFrom);
  if (f.yearTo) add('ap.graduation_year <= ?', f.yearTo);
  if (f.deptId) add('ap.dept_id = ?', f.deptId);
  if (f.industry) add('LOWER(ap.industry) = LOWER(?)', f.industry);
  if (f.city) add('LOWER(ap.city) = LOWER(?)', f.city);
  if (f.country) add('LOWER(ap.country) = LOWER(?)', f.country);
  if (f.company) add('ap.current_company ILIKE ?', likePattern(f.company));
  if (f.skill) {
    add(
      `EXISTS (SELECT 1 FROM user_skill us JOIN skill s ON s.skill_id = us.skill_id
                WHERE us.user_id = u.user_id AND LOWER(s.skill_name) = LOWER(?))`,
      f.skill
    );
  }
  if (f.interest) {
    add(
      `EXISTS (SELECT 1 FROM user_interest ui JOIN interest i ON i.interest_id = ui.interest_id
                WHERE ui.user_id = u.user_id AND LOWER(i.interest_name) = LOWER(?))`,
      f.interest
    );
  }
  return { whereSql: where.join(' AND '), values };
}

async function search(filters) {
  const { whereSql, values } = buildFilters(filters);
  const from = `FROM alumni_profile ap
                JOIN users u ON u.user_id = ap.user_id
                JOIN department d ON d.dept_id = ap.dept_id
               WHERE ${whereSql}`;

  const { rows: countRows } = await query(`SELECT COUNT(*)::int AS total ${from}`, values);
  const { limit, offset } = toLimitOffset(filters);

  const { rows } = await query(
    `SELECT u.user_id AS "userId", u.full_name AS "fullName", ap.degree, ap.graduation_year AS "graduationYear",
            d.dept_id AS "deptId", d.dept_code AS "deptCode", d.dept_name AS "deptName",
            ap.current_company AS "currentCompany", ap.designation, ap.industry, ap.city, ap.country,
            ap.photo_url AS "photoUrl", ap.verification_status AS "verificationStatus",
            ARRAY(SELECT s.skill_name FROM user_skill us JOIN skill s ON s.skill_id = us.skill_id
                   WHERE us.user_id = u.user_id ORDER BY LOWER(s.skill_name)) AS skills
       ${from}
      ORDER BY ${SORTS[filters.sort] ?? SORTS.name}
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset]
  );

  return { rows, total: countRows[0].total };
}

// Distinct values for the directory filter dropdowns (verified alumni only).
async function filterOptions() {
  const distinct = async (column) => {
    const { rows } = await query(
      `SELECT DISTINCT ${column} AS value FROM alumni_profile
        WHERE verification_status = 'VERIFIED' AND ${column} IS NOT NULL
        ORDER BY value`
    );
    return rows.map((r) => r.value);
  };

  const { rows: departments } = await query(
    'SELECT dept_id AS "deptId", dept_code AS "deptCode", dept_name AS "deptName" FROM department ORDER BY dept_name'
  );

  return {
    departments,
    graduationYears: await distinct('graduation_year'),
    industries: await distinct('industry'),
    cities: await distinct('city'),
    countries: await distinct('country'),
  };
}

module.exports = { search, filterOptions };
