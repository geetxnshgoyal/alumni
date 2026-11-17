const ApiError = require('../../utils/ApiError');
const { paginationMeta } = require('../../utils/pagination');
const jobs = require('./jobs.model');
const audit = require('../audit/audit.model');
const notifications = require('../notifications/notifications.model');

// POST /api/jobs (alumni/admin)
async function create(req, res) {
  const job = await jobs.create({
    postedBy: req.user.id,
    ...req.valid.body,
  });
  res.status(201).json({ data: job });
}

// GET /api/jobs
async function list(req, res) {
  const { rows, total } = await jobs.list(req.valid.query);
  const pagination = paginationMeta(req.valid.query, total);
  res.json({
    data: rows,
    pagination,
    meta: pagination,
  });
}

// GET /api/jobs/:id
async function getById(req, res) {
  const job = await jobs.findById(req.valid.params.id);
  if (!job) {
    throw ApiError.notFound('Job post not found');
  }
  res.json({ data: job });
}

// PATCH /api/jobs/:id (poster or admin only)
async function update(req, res) {
  const { id } = req.valid.params;
  const existing = await jobs.findById(id);
  if (!existing) {
    throw ApiError.notFound('Job post not found');
  }

  if (existing.postedBy !== req.user.id && req.user.role !== 'ADMIN') {
    throw ApiError.forbidden('Only the job poster or an admin can update this job post');
  }

  const updated = await jobs.update(id, req.valid.body);
  res.json({ data: updated });
}

// PATCH /api/jobs/:id/close (poster or admin only)
async function close(req, res) {
  const { id } = req.valid.params;
  const existing = await jobs.findById(id);
  if (!existing) {
    throw ApiError.notFound('Job post not found');
  }

  if (existing.postedBy !== req.user.id && req.user.role !== 'ADMIN') {
    throw ApiError.forbidden('Only the job poster or an admin can close this job post');
  }

  const closed = await jobs.updateStatus(id, 'CLOSED');
  await audit.log({ actorId: req.user.id, action: 'JOB_CLOSE', entityName: 'job_post', entityId: id, ip: req.ip });

  res.json({ data: closed });
}

// POST /api/jobs/:id/apply (authenticated users)
async function apply(req, res) {
  const { id: jobId } = req.valid.params;
  const job = await jobs.findById(jobId);
  if (!job) {
    throw ApiError.notFound('Job post not found');
  }

  if (job.status !== 'OPEN') {
    throw ApiError.badRequest('Cannot apply to a closed or inactive job post');
  }

  const existing = await jobs.findApplication(jobId, req.user.id);
  if (existing) {
    throw ApiError.conflict('You have already applied to this job');
  }

  let application;
  try {
    application = await jobs.apply({
      jobId,
      applicantId: req.user.id,
      resumeUrl: req.valid.body?.resumeUrl,
      coverNote: req.valid.body?.coverNote,
    });
  } catch (err) {
    if (err.code === '23505') {
      throw ApiError.conflict('You have already applied to this job');
    }
    throw err;
  }

  res.status(201).json({ data: application });
}

// PATCH /api/applications/:id/status (poster or admin only)
async function updateApplicationStatus(req, res) {
  const { id } = req.valid.params;
  const application = await jobs.findApplicationById(id);
  if (!application) {
    throw ApiError.notFound('Application not found');
  }

  if (application.postedBy !== req.user.id && req.user.role !== 'ADMIN') {
    throw ApiError.forbidden('Only the job poster or an admin can update application status');
  }

  const { status } = req.valid.body;
  const updated = await jobs.updateApplicationStatus(id, status);

  await notifications.notify(application.applicantId, {
    type: 'JOB_APPLICATION',
    title: `Application status updated: ${status}`,
    body: `Your application for "${application.jobTitle}" at ${application.companyName} is now ${status}.`,
    linkUrl: `#/jobs/${application.jobId}`,
  });

  res.json({ data: updated });
}

// GET /api/jobs/:id/applications (poster or admin only)
async function listApplicationsForJob(req, res) {
  const { id: jobId } = req.valid.params;
  const job = await jobs.findById(jobId);
  if (!job) {
    throw ApiError.notFound('Job post not found');
  }

  if (job.postedBy !== req.user.id && req.user.role !== 'ADMIN') {
    throw ApiError.forbidden('Only the job poster or an admin can view applications');
  }

  const query = req.valid?.query || { page: 1, limit: 20 };
  const { rows, total } = await jobs.listApplicationsForJob(jobId, query);
  const pagination = paginationMeta(query, total);
  res.json({ data: rows, pagination, meta: pagination });
}

// GET /api/applications/me (authenticated user)
async function listMyApplications(req, res) {
  const query = req.valid?.query || { page: 1, limit: 20 };
  const { rows, total } = await jobs.listApplicationsForUser(req.user.id, query);
  const pagination = paginationMeta(query, total);
  res.json({ data: rows, pagination, meta: pagination });
}

// GET /api/applications/:id (applicant, poster, or admin)
async function getApplicationById(req, res) {
  const { id } = req.valid.params;
  const application = await jobs.findApplicationById(id);
  if (!application) {
    throw ApiError.notFound('Application not found');
  }

  if (application.applicantId !== req.user.id && application.postedBy !== req.user.id && req.user.role !== 'ADMIN') {
    throw ApiError.forbidden('You are not authorized to view this application');
  }

  res.json({ data: application });
}

module.exports = {
  create,
  list,
  getById,
  update,
  close,
  apply,
  updateApplicationStatus,
  listApplicationsForJob,
  listMyApplications,
  getApplicationById,
};
