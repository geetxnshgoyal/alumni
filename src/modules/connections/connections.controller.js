const ApiError = require('../../utils/ApiError');
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

module.exports = {
  create,
};
