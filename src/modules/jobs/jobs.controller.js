const ApiError = require('../../utils/ApiError');
const { paginationMeta } = require('../../utils/pagination');
const jobs = require('./jobs.model');

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

module.exports = {
  create,
  list,
  getById,
};

