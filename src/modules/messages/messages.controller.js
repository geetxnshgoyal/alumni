const ApiError = require('../../utils/ApiError');
const { paginationMeta } = require('../../utils/pagination');
const messages = require('./messages.model');
const connections = require('../connections/connections.model');
const notifications = require('../notifications/notifications.model');

// POST /api/messages
async function send(req, res) {
  const { connectionId, content } = req.valid.body;

  const connection = await connections.findById(connectionId);
  if (!connection) {
    throw ApiError.notFound('Connection not found');
  }

  const isParticipant = connection.requesterId === req.user.id || connection.receiverId === req.user.id;
  if (!isParticipant) {
    throw ApiError.forbidden('You are not a participant in this connection');
  }

  if (connection.status !== 'ACCEPTED') {
    throw ApiError.forbidden('Only users with an accepted connection can send messages');
  }

  const message = await messages.create({
    connectionId,
    senderId: req.user.id,
    content,
  });

  const recipientId = connection.requesterId === req.user.id ? connection.receiverId : connection.requesterId;
  await notifications.notify(recipientId, {
    type: 'NEW_MESSAGE',
    title: `New message from ${req.user.fullName}`,
    body: content.length > 100 ? `${content.substring(0, 97)}...` : content,
    linkUrl: '#/network',
  });

  res.status(201).json({ data: message });
}

// GET /api/messages?connectionId=
async function list(req, res) {
  const { connectionId } = req.valid.query;

  const connection = await connections.findById(connectionId);
  if (!connection) {
    throw ApiError.notFound('Connection not found');
  }

  const isParticipant = connection.requesterId === req.user.id || connection.receiverId === req.user.id;
  if (!isParticipant && req.user.role !== 'ADMIN') {
    throw ApiError.forbidden('You are not a participant in this connection');
  }

  if (connection.status !== 'ACCEPTED' && req.user.role !== 'ADMIN') {
    throw ApiError.forbidden('Only users with an accepted connection can view messages');
  }

  const { rows, total } = await messages.listByConnection(connectionId, req.valid.query);
  const pagination = paginationMeta(req.valid.query, total);

  res.json({
    data: rows,
    pagination,
    meta: pagination,
  });
}

module.exports = {
  send,
  list,
};
