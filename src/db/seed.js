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

    // Seed Member C Modules: Campaigns, Success Stories, Surveys, and Feedback
    const aaravUser = (await db.query("SELECT user_id FROM users WHERE email = 'aarav@alumni.test'")).rows[0];
    const diyaUser = (await db.query("SELECT user_id FROM users WHERE email = 'diya@alumni.test'")).rows[0];
    const kabirUser = (await db.query("SELECT user_id FROM users WHERE email = 'kabir@alumni.test'")).rows[0];

    // Seed Success Stories
    if (aaravUser) {
      await db.query(`
        INSERT INTO success_story (author_id, title, body, category, status, reviewed_by, reviewed_at, review_note)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
        ON CONFLICT DO NOTHING
      `, [
        aaravUser.user_id,
        'From Campus Coding Club to Engineering Leader at Google',
        'Reflecting on my years at college, the student tech symposiums and algorithmic competitions gave me the foundational grit for distributed computing. Today leading backend infrastructure teams at Google, I encourage every student to deeply master algorithms, networks, and Unix fundamentals.',
        'CAREER',
        'APPROVED',
        adminId,
        'Inspiring alumni journey approved for campus spotlight.'
      ]);
    }

    if (diyaUser) {
      await db.query(`
        INSERT INTO success_story (author_id, title, body, category, status, reviewed_by, reviewed_at, review_note)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
        ON CONFLICT DO NOTHING
      `, [
        diyaUser.user_id,
        'Building Product Strategy Across Global Engineering Teams',
        'Transitioning from an engineering graduate to product leadership at Microsoft required blending systems thinking with customer empathy. Connecting back with the college community and mentoring juniors has been one of the most rewarding parts of my career.',
        'LEADERSHIP',
        'APPROVED',
        adminId,
        'Featured story on international tech career paths.'
      ]);
    }

    if (kabirUser) {
      await db.query(`
        INSERT INTO success_story (author_id, title, body, category, status)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
      `, [
        kabirUser.user_id,
        'Scaling Sustainable Electric Mobility at Tata Motors',
        'Leading plant modernization and lean assembly lines for India’s next-generation electric vehicles began in our college mechanical workshop. Here is my perspective on how hardware and software engineering are converging in automotive.',
        'INNOVATION',
        'SUBMITTED'
      ]);
    }

    // Seed Survey with Questions & Options
    const { rows: surveyRows } = await db.query(`
      SELECT survey_id FROM survey WHERE title = 'Alumni Mentorship & Industry Readiness Survey 2026'
    `);
    let surveyId;
    if (surveyRows.length === 0) {
      const res = await db.query(`
        INSERT INTO survey (created_by, title, description, status, opens_at)
        VALUES ($1, $2, $3, 'ACTIVE', NOW())
        RETURNING survey_id
      `, [
        adminId,
        'Alumni Mentorship & Industry Readiness Survey 2026',
        'Help shape our 2026-2027 curriculum, mentorship circles, and hands-on laboratory workshops for current undergraduates.'
      ]);
      surveyId = res.rows[0].survey_id;

      // Question 1: Rating
      await db.query(`
        INSERT INTO survey_question (survey_id, question_text, question_type, is_required, position)
        VALUES ($1, $2, 'RATING', TRUE, 1)
      `, [surveyId, 'How would you rate the current industry relevance of core engineering subjects (1: Outdated, 5: Highly Relevant)?']);

      // Question 2: Multi Choice
      const q2Res = await db.query(`
        INSERT INTO survey_question (survey_id, question_text, question_type, is_required, position)
        VALUES ($1, $2, 'MULTI_CHOICE', TRUE, 2)
        RETURNING question_id
      `, [surveyId, 'Which domains should our departments prioritize for elective coursework?']);
      const q2Id = q2Res.rows[0].question_id;
      for (const [pos, opt] of [['1', 'Cloud & Distributed Systems'], ['2', 'AI & Machine Learning'], ['3', 'Embedded Systems & Robotics'], ['4', 'Fullstack & Mobile Engineering']].entries()) {
        await db.query(`
          INSERT INTO question_option (question_id, option_text, position)
          VALUES ($1, $2, $3)
        `, [q2Id, opt[1], pos + 1]);
      }

      // Question 3: Single Choice
      const q3Res = await db.query(`
        INSERT INTO survey_question (survey_id, question_text, question_type, is_required, position)
        VALUES ($1, $2, 'SINGLE_CHOICE', TRUE, 3)
        RETURNING question_id
      `, [surveyId, 'Would you be open to offering virtual mentorship or mock interviews for final-year students?']);
      const q3Id = q3Res.rows[0].question_id;
      for (const [pos, opt] of [['1', 'Yes, count me in for virtual sessions'], ['2', 'Yes, for campus visits & workshops'], ['3', 'Not this semester']].entries()) {
        await db.query(`
          INSERT INTO question_option (question_id, option_text, position)
          VALUES ($1, $2, $3)
        `, [q3Id, opt[1], pos + 1]);
      }

      // Question 4: Text
      await db.query(`
        INSERT INTO survey_question (survey_id, question_text, question_type, is_required, position)
        VALUES ($1, $2, 'TEXT', FALSE, 4)
      `, [surveyId, 'Any additional recommendations for university leadership or student development?']);
    }

    // Seed Sample Feedback
    if (aaravUser) {
      await db.query(`
        INSERT INTO feedback (user_id, category, message, status, admin_response, responded_by, responded_at)
        VALUES ($1, $2, $3, 'IN_REVIEW', $4, $5, NOW())
        ON CONFLICT DO NOTHING
      `, [
        aaravUser.user_id,
        'PLATFORM',
        'The new GradLink UI design and campaign contributions page look great! Could we also get automated calendar invites when networking connection requests are accepted?',
        'Thank you Aarav! Calendar export and sync are being evaluated for the upcoming release.',
        adminId
      ]);
    }
    if (kabirUser) {
      await db.query(`
        INSERT INTO feedback (user_id, category, message, status)
        VALUES ($1, $2, $3, 'OPEN')
        ON CONFLICT DO NOTHING
      `, [
        kabirUser.user_id,
        'CAREER',
        'Our electric mobility engineering division has 5 open graduate apprenticeships. We would love to host an exclusive campus recruitment round.'
      ]);
    }

    // Seed Events
    await db.query(`
      INSERT INTO event (created_by, title, description, event_type, mode, venue_or_link, start_at, end_at, capacity, registration_deadline, status)
      VALUES 
        ($1, 'Grand Alumni Homecoming & Reunion 2026', 'Celebrate memories, re-connect with batchmates, and witness campus growth at our flagship reunion gala.', 'REUNION', 'OFFLINE', 'Campus Central Grounds & Auditorium', NOW() + INTERVAL '30 days', NOW() + INTERVAL '30 days 6 hours', 250, NOW() + INTERVAL '25 days', 'OPEN'),
        ($1, 'AI & Distributed Systems Workshop', 'Interactive masterclass on LLMs and high-concurrency systems presented by alumni engineering leaders.', 'WORKSHOP', 'ONLINE', 'https://meet.google.com/alumni-ai-workshop', NOW() + INTERVAL '14 days', NOW() + INTERVAL '14 days 3 hours', 100, NOW() + INTERVAL '12 days', 'OPEN')
      ON CONFLICT DO NOTHING
    `, [adminId]);
  });

  console.log(`Seed complete. Demo alumni/students log in with password: ${DEMO_PASSWORD}`);
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
