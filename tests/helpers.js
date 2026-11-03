const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/db/pool');
const { migrate } = require('../src/db/migrate');
const users = require('../src/modules/users/users.model');
const { hashPassword, signToken } = require('../src/modules/auth/auth.service');

const api = () => request(app);

async function setupDb() {
  await migrate({ silent: true });
}

// Wipes every table except schema_migrations so each test starts clean.
async function resetDb() {
  const { rows } = await pool.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'`
  );
  if (rows.length) {
    await pool.query(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
  }
}

async function closeDb() {
  await pool.end();
}

async function createDepartment(code = 'CE', name = 'Computer Engineering') {
  const { rows } = await pool.query(
    'INSERT INTO department (dept_code, dept_name) VALUES ($1, $2) RETURNING dept_id',
    [code, name]
  );
  return rows[0].dept_id;
}

let counter = 0;

// Inserts a user directly (bypassing the API) and returns { id, token, email, password }.
async function createUser({ role = 'ALUMNI', deptId, verified = true, profile = {}, skills = [], fullName } = {}) {
  counter += 1;
  const email = `user${counter}@test.com`;
  const password = 'Password123';
  const id = await users.createUser(pool, {
    email,
    passwordHash: await hashPassword(password),
    fullName: fullName ?? `Test User ${counter}`,
    role,
  });

  if (role === 'ALUMNI') {
    await users.createAlumniProfile(pool, id, {
      deptId,
      enrollmentNo: `ENR${counter}`,
      degree: 'B.E.',
      graduationYear: 2018,
      ...profile,
    });
    if (verified) await users.setVerification(id, 'VERIFIED', null);
  }
  if (role === 'STUDENT') {
    await users.createStudentProfile(pool, id, {
      deptId,
      enrollmentNo: `ENR${counter}`,
      currentSemester: 5,
      expectedGradYear: new Date().getFullYear() + 1,
      ...profile,
    });
  }
  if (skills.length) await users.setTags(pool, 'skills', id, skills);

  return { id, email, password, token: signToken({ user_id: id, role }) };
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { api, setupDb, resetDb, closeDb, createDepartment, createUser, auth, pool };
