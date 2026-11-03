// Loads demo data: departments, one admin, sample alumni and students.
// Safe to run more than once - existing rows are skipped.
// Usage: npm run seed
const { pool, withTransaction } = require('./pool');
const { migrate } = require('./migrate');
const users = require('../modules/users/users.model');
const { hashPassword } = require('../modules/auth/auth.service');

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'Alumni@123';

const departments = [
  ['CE', 'Computer Engineering'],
  ['IT', 'Information Technology'],
  ['EC', 'Electronics & Communication'],
  ['EE', 'Electrical Engineering'],
  ['ME', 'Mechanical Engineering'],
  ['CL', 'Civil Engineering'],
];

// [name, dept, year, company, designation, industry, city, country, skills, interests, status]
const alumni = [
  ['Aarav Patel', 'CE', 2016, 'Google', 'Senior Software Engineer', 'Technology', 'Bengaluru', 'India', ['Go', 'Distributed Systems'], ['Mentoring', 'Open Source'], 'VERIFIED'],
  ['Diya Shah', 'IT', 2018, 'Microsoft', 'Product Manager', 'Technology', 'Hyderabad', 'India', ['Product Strategy', 'SQL'], ['Startups', 'Mentoring'], 'VERIFIED'],
  ['Kabir Mehta', 'ME', 2012, 'Tata Motors', 'Plant Manager', 'Automotive', 'Pune', 'India', ['Lean Manufacturing', 'CAD'], ['Electric Vehicles'], 'VERIFIED'],
  ['Ananya Desai', 'EC', 2015, 'Qualcomm', 'Hardware Engineer', 'Semiconductors', 'San Diego', 'USA', ['VLSI', 'Embedded C'], ['Research', 'Mentoring'], 'VERIFIED'],
  ['Rohan Joshi', 'CE', 2020, 'Razorpay', 'Backend Engineer', 'Fintech', 'Bengaluru', 'India', ['Node.js', 'PostgreSQL'], ['Startups', 'Open Source'], 'VERIFIED'],
  ['Isha Trivedi', 'CL', 2010, 'L&T Construction', 'Project Director', 'Infrastructure', 'Ahmedabad', 'India', ['Project Management', 'AutoCAD'], ['Sustainability'], 'VERIFIED'],
  ['Vivaan Parikh', 'EE', 2014, 'Adani Green Energy', 'Grid Engineer', 'Energy', 'Ahmedabad', 'India', ['Power Systems', 'MATLAB'], ['Sustainability', 'Research'], 'VERIFIED'],
  ['Meera Iyer', 'IT', 2019, 'Amazon', 'Data Scientist', 'Technology', 'Seattle', 'USA', ['Python', 'Machine Learning'], ['AI', 'Mentoring'], 'VERIFIED'],
  ['Arjun Rana', 'CE', 2017, 'Infosys', 'Technical Architect', 'IT Services', 'Gandhinagar', 'India', ['Java', 'Cloud'], ['Teaching'], 'VERIFIED'],
  ['Saanvi Bhatt', 'EC', 2021, 'ISRO', 'Scientist', 'Aerospace', 'Ahmedabad', 'India', ['Signal Processing', 'Python'], ['Research', 'Space'], 'VERIFIED'],
  ['Neel Chauhan', 'ME', 2022, 'Ola Electric', 'Design Engineer', 'Automotive', 'Bengaluru', 'India', ['SolidWorks', 'CAD'], ['Electric Vehicles', 'Startups'], 'PENDING'],
  ['Priya Nair', 'IT', 2023, 'Zomato', 'Frontend Engineer', 'Technology', 'Gurugram', 'India', ['React', 'TypeScript'], ['Open Source'], 'PENDING'],
];

const students = [
  ['Harsh Vora', 'CE', 6, 2027, ['JavaScript'], ['Startups']],
  ['Riya Solanki', 'IT', 4, 2028, ['Python'], ['AI', 'Mentoring']],
];

async function seed() {
  await migrate({ silent: true });
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@alumni.test').toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';

  await withTransaction(async (db) => {
    for (const [code, name] of departments) {
      await db.query('INSERT INTO department (dept_code, dept_name) VALUES ($1, $2) ON CONFLICT DO NOTHING', [code, name]);
    }
    const { rows } = await db.query('SELECT dept_id, dept_code FROM department');
    const deptId = Object.fromEntries(rows.map((r) => [r.dept_code, r.dept_id]));

    const exists = async (email) => (await db.query('SELECT 1 FROM users WHERE email = $1', [email])).rowCount > 0;

    let adminId;
    if (await exists(adminEmail)) {
      adminId = (await db.query('SELECT user_id FROM users WHERE email = $1', [adminEmail])).rows[0].user_id;
    } else {
      adminId = await users.createUser(db, {
        email: adminEmail,
        passwordHash: await hashPassword(adminPassword),
        fullName: 'Alumni Cell Admin',
        role: 'ADMIN',
      });
      console.log(`Created admin ${adminEmail}`);
    }

    let n = 0;
    for (const [fullName, dept, year, company, designation, industry, city, country, skills, interests, status] of alumni) {
      n += 1;
      const email = `${fullName.split(' ')[0].toLowerCase()}@alumni.test`;
      if (await exists(email)) continue;
      const id = await users.createUser(db, { email, passwordHash, fullName, role: 'ALUMNI' });
      await users.createAlumniProfile(db, id, {
        deptId: deptId[dept],
        enrollmentNo: `${year - 4}${dept}${String(n).padStart(3, '0')}`,
        degree: 'B.E.',
        graduationYear: year,
        currentCompany: company,
        designation,
        industry,
        city,
        country,
        bio: `${designation} at ${company}. Happy to help juniors from ${dept}.`,
      });
      await users.setTags(db, 'skills', id, skills);
      await users.setTags(db, 'interests', id, interests);
      if (status === 'VERIFIED') await users.setVerification(id, 'VERIFIED', adminId, db);
    }

    for (const [fullName, dept, semester, gradYear, skills, interests] of students) {
      n += 1;
      const email = `${fullName.split(' ')[0].toLowerCase()}@student.test`;
      if (await exists(email)) continue;
      const id = await users.createUser(db, { email, passwordHash, fullName, role: 'STUDENT' });
      await users.createStudentProfile(db, id, {
        deptId: deptId[dept],
        enrollmentNo: `${gradYear - 4}${dept}${String(n).padStart(3, '0')}`,
        currentSemester: semester,
        expectedGradYear: gradYear,
      });
      await users.setTags(db, 'skills', id, skills);
      await users.setTags(db, 'interests', id, interests);
    }
  });

  console.log(`Seed complete. Demo alumni/students log in with password: ${DEMO_PASSWORD}`);
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
