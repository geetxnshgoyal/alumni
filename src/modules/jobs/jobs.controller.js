const ApiError = require('../../utils/ApiError');
const { paginationMeta } = require('../../utils/pagination');
const jobs = require('./jobs.model');
const audit = require('../audit/audit.model');

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

module.exports = {
  create,
  list,
  getById,
  update,
  close,
};
