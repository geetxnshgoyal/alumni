const { query } = require('../../db/pool');
const ApiError = require('../../utils/ApiError');
const { paginationMeta } = require('../../utils/pagination');
const users = require('../users/users.model');
const notifications = require('../notifications/notifications.model');
const audit = require('../audit/audit.model');

// GET /api/admin/stats
async function stats(req, res) {
  const { rows: verification } = await query(
    `SELECT verification_status AS status, COUNT(*)::int AS count FROM alumni_profile GROUP BY verification_status`
  );
  const { rows: byDepartment } = await query(
    `SELECT d.dept_code AS "deptCode", d.dept_name AS "deptName", COUNT(ap.user_id)::int AS alumni
       FROM department d
       LEFT JOIN alumni_profile ap ON ap.dept_id = d.dept_id AND ap.verification_status = 'VERIFIED'
      GROUP BY d.dept_id ORDER BY alumni DESC, d.dept_name`
  );
  res.json({
    data: {
      users: await users.countsByRole(),
      alumniVerification: Object.fromEntries(verification.map((r) => [r.status, r.count])),
      byDepartment,
    },
  });
}

// PATCH /api/admin/alumni/:id/verification
async function verifyAlumni(req, res) {
  const { id } = req.valid.params;
  const { status, note } = req.valid.body;

  const result = await users.setVerification(id, status, req.user.id);
  if (!result) throw ApiError.notFound('Alumni profile not found');

  await notifications.notify(id, {
    type: 'VERIFICATION',
    title: status === 'VERIFIED' ? 'Your alumni profile has been verified' : 'Your alumni profile verification was rejected',
    body: note ?? null,
    linkUrl: '#/profile',
  });
  await audit.log({ actorId: req.user.id, action: `ALUMNI_${status}`, entityName: 'alumni_profile', entityId: id, ip: req.ip });

  res.json({ data: result });
}

// PATCH /api/admin/users/:id/status
async function setAccountStatus(req, res) {
  const { id } = req.valid.params;
  const { accountStatus } = req.valid.body;

  if (id === req.user.id) throw ApiError.badRequest('You cannot change the status of your own account');

  const result = await users.setAccountStatus(id, accountStatus);
  if (!result) throw ApiError.notFound('User not found');

  await audit.log({ actorId: req.user.id, action: `USER_${accountStatus}`, entityName: 'users', entityId: id, ip: req.ip });
  res.json({ data: result });
}

// GET /api/admin/audit-logs
async function auditLogs(req, res) {
  const params = req.valid.query;
  const { rows, total } = await audit.list(params);
  res.json({ data: rows, pagination: paginationMeta(params, total) });
}

// GET /api/admin/users
async function listUsers(req, res) {
  const params = req.valid.query;
  const { rows, total } = await users.listUsers(params);
  res.json({ data: rows, pagination: paginationMeta(params, total) });
}

module.exports = { stats, verifyAlumni, setAccountStatus, auditLogs, listUsers };
