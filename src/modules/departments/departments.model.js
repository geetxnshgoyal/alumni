const { query } = require('../../db/pool');

const COLUMNS = 'd.dept_id AS "deptId", d.dept_code AS "deptCode", d.dept_name AS "deptName"';

async function list() {
  const { rows } = await query(
    `SELECT ${COLUMNS},
            (SELECT COUNT(*)::int FROM alumni_profile ap
              WHERE ap.dept_id = d.dept_id AND ap.verification_status = 'VERIFIED') AS "alumniCount"
       FROM department d
      ORDER BY d.dept_name`
  );
  return rows;
}

async function findById(deptId) {
  const { rows } = await query(`SELECT ${COLUMNS} FROM department d WHERE d.dept_id = $1`, [deptId]);
  return rows[0];
}

async function create({ deptCode, deptName }) {
  const { rows } = await query(
    `INSERT INTO department AS d (dept_code, dept_name) VALUES ($1, $2) RETURNING ${COLUMNS}`,
    [deptCode, deptName]
  );
  return rows[0];
}

async function update(deptId, { deptCode, deptName }) {
  const { rows } = await query(
    `UPDATE department AS d
        SET dept_code = COALESCE($2, d.dept_code), dept_name = COALESCE($3, d.dept_name)
      WHERE d.dept_id = $1
      RETURNING ${COLUMNS}`,
    [deptId, deptCode ?? null, deptName ?? null]
  );
  return rows[0];
}

async function remove(deptId) {
  const { rowCount } = await query('DELETE FROM department WHERE dept_id = $1', [deptId]);
  return rowCount > 0;
}

module.exports = { list, findById, create, update, remove };
