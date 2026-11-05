const { Router } = require('express');
const { pool } = require('../db/pool');

const router = Router();

router.get('/health', async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ data: { status: 'ok', database: 'connected', time: new Date().toISOString() } });
});

// Each feature module owns its own router. To add a module, see docs/CONTRIBUTING.md.

// Core + shared (team lead)
router.use('/auth', require('../modules/auth/auth.routes'));
router.use('/', require('../modules/profile/profile.routes')); // /profile/me, /skills, /interests
router.use('/alumni', require('../modules/alumni/alumni.routes'));
router.use('/departments', require('../modules/departments/departments.routes'));
router.use('/notifications', require('../modules/notifications/notifications.routes'));
router.use('/admin', require('../modules/admin/admin.routes'));

// Member B - networking, jobs, events
router.use('/connections', require('../modules/connections/connections.routes'));
// router.use('/messages', require('../modules/messages/messages.routes'));
// router.use('/jobs', require('../modules/jobs/jobs.routes'));
// router.use('/events', require('../modules/events/events.routes'));

// Member C - donations, success stories, surveys, feedback
router.use('/campaigns', require('../modules/donations/campaigns.routes'));
// router.use('/donations', require('../modules/donations/donations.routes'));
// router.use('/stories', require('../modules/stories/stories.routes'));
// router.use('/surveys', require('../modules/surveys/surveys.routes'));
// router.use('/feedback', require('../modules/feedback/feedback.routes'));

module.exports = router;
