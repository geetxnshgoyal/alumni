const ApiError = require('../../utils/ApiError');
const { paginationMeta } = require('../../utils/pagination');
const alumni = require('./alumni.model');
const users = require('../users/users.model');

// GET /api/alumni
async function search(req, res) {
  const filters = { ...req.valid.query };
  if (filters.status && req.user.role !== 'ADMIN') {
    throw ApiError.forbidden('Only administrators can filter by verification status');
  }

  const { rows, total } = await alumni.search(filters);
  res.json({ data: rows, pagination: paginationMeta(filters, total) });
}

// GET /api/alumni/filters
async function filterOptions(req, res) {
  res.json({ data: await alumni.filterOptions() });
}

// GET /api/alumni/:id
async function getById(req, res) {
  const { id } = req.valid.params;
  const profile = await users.getFullProfile(id);
  const isAdmin = req.user.role === 'ADMIN';
  const isSelf = req.user.id === id;

  // Unverified or suspended alumni are hidden from everyone except admins and themselves.
  const visible = profile?.role === 'ALUMNI' && (isAdmin || isSelf || (profile.verificationStatus === 'VERIFIED' && profile.accountStatus === 'ACTIVE'));
  if (!visible) throw ApiError.notFound('Alumni not found');

  // Contact details are private.
  if (!isAdmin && !isSelf) {
    delete profile.phone;
    delete profile.email;
    delete profile.lastLoginAt;
    delete profile.accountStatus;
  }

  res.json({ data: profile });
}

module.exports = { search, filterOptions, getById };
