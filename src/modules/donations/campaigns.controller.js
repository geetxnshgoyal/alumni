const ApiError = require('../../utils/ApiError');
const { paginationMeta } = require('../../utils/pagination');
const campaigns = require('./campaigns.model');
const audit = require('../audit/audit.model');

// POST /api/campaigns (admin only)
async function create(req, res) {
  const campaign = await campaigns.create({
    createdBy: req.user.id,
    ...req.valid.body,
  });
  await audit.log({ actorId: req.user.id, action: 'CAMPAIGN_CREATE', entityName: 'campaign', entityId: campaign.campaignId, ip: req.ip });
  res.status(201).json({ data: campaign });
}

// GET /api/campaigns
async function list(req, res) {
  const { rows, total } = await campaigns.list(req.valid.query);
  res.json({
    data: rows,
    meta: paginationMeta(req.valid.query, total),
  });
}

// GET /api/campaigns/:id
async function getById(req, res) {
  const campaign = await campaigns.findById(req.valid.params.id);
  if (!campaign) {
    throw ApiError.notFound('Campaign not found');
  }
  res.json({ data: campaign });
}

// PATCH /api/campaigns/:id (admin only)
async function update(req, res) {
  const existing = await campaigns.findById(req.valid.params.id);
  if (!existing) {
    throw ApiError.notFound('Campaign not found');
  }
  const updated = await campaigns.update(req.valid.params.id, req.valid.body);
  await audit.log({ actorId: req.user.id, action: 'CAMPAIGN_UPDATE', entityName: 'campaign', entityId: req.valid.params.id, ip: req.ip });
  res.json({ data: updated });
}

// PATCH /api/campaigns/:id/close (admin only)
async function close(req, res) {
  const existing = await campaigns.findById(req.valid.params.id);
  if (!existing) {
    throw ApiError.notFound('Campaign not found');
  }
  const closed = await campaigns.updateStatus(req.valid.params.id, 'CLOSED');
  await audit.log({ actorId: req.user.id, action: 'CAMPAIGN_CLOSE', entityName: 'campaign', entityId: req.valid.params.id, ip: req.ip });
  res.json({ data: closed });
}

module.exports = {
  create,
  list,
  getById,
  update,
  close,
};
