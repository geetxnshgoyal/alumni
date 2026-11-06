const ApiError = require('../../utils/ApiError');
const { paginationMeta } = require('../../utils/pagination');
const connections = require('./connections.model');
const users = require('../users/users.model');
const notifications = require('../notifications/notifications.model');

// POST /api/connections
async function create(req, res) {
  const requesterId = req.user.id;
  const { receiverId, connectionType, requestNote } = req.valid.body;

  if (requesterId === receiverId) {
    throw ApiError.badRequest('Cannot connect to yourself');
  }

  const receiver = await users.findById(receiverId);
  if (!receiver) {
    throw ApiError.notFound('User not found');
  }

  const existing = await connections.findBetweenUsers(requesterId, receiverId);
  if (existing) {
    throw ApiError.conflict('Connection request already exists between these users');
  }

  const connection = await connections.create({
    requesterId,
    receiverId,
    connectionType,
    requestNote,
  });

  await notifications.notify(receiverId, {
    type: 'CONNECTION_REQUEST',
    title: `${req.user.fullName} sent you a connection request`,
    body: requestNote || null,
    linkUrl: '#/network',
  });

  res.status(201).json({ data: connection });
}

// GET /api/connections
async function list(req, res) {
  const params = req.valid.query;
  const { rows, total } = await connections.listForUser(req.user.id, params);
  const pagination = paginationMeta(params, total);
  res.json({
    data: rows,
    pagination,
    meta: pagination,
  });
}

// GET /api/connections/:id
async function getById(req, res) {
  const connection = await connections.findById(req.valid.params.id);
  if (!connection) {
    throw ApiError.notFound('Connection request not found');
  }
  if (connection.requesterId !== req.user.id && connection.receiverId !== req.user.id && req.user.role !== 'ADMIN') {
    throw ApiError.forbidden("Cannot view another user's connection");
  }
  res.json({ data: connection });
}

// PATCH /api/connections/:id/accept
async function accept(req, res) {
  const { id } = req.valid.params;
  const connection = await connections.findById(id);
  if (!connection) {
    throw ApiError.notFound('Connection request not found');
  }

  if (connection.receiverId !== req.user.id) {
    throw ApiError.forbidden('Only the receiver can accept a connection request');
  }

  const updated = await connections.updateStatus(id, 'ACCEPTED');

  await notifications.notify(connection.requesterId, {
    type: 'CONNECTION_ACCEPTED',
    title: `${req.user.fullName} accepted your connection request`,
    body: null,
    linkUrl: '#/network',
  });

  res.json({ data: updated });
}

// PATCH /api/connections/:id/reject
async function reject(req, res) {
  const { id } = req.valid.params;
  const connection = await connections.findById(id);
  if (!connection) {
    throw ApiError.notFound('Connection request not found');
  }

  if (connection.receiverId !== req.user.id) {
    throw ApiError.forbidden('Only the receiver can reject a connection request');
  }

  const updated = await connections.updateStatus(id, 'REJECTED');
  res.json({ data: updated });
}

module.exports = {
  create,
  list,
  getById,
  accept,
  reject,
};
