const ApiError = require('../../utils/ApiError');
const departments = require('./departments.model');
const audit = require('../audit/audit.model');

// GET /api/departments (public - needed by the registration form)
async function list(req, res) {
  res.json({ data: await departments.list() });
}

// POST /api/departments (admin)
async function create(req, res) {
  const dept = await departments.create(req.valid.body);
  await audit.log({ actorId: req.user.id, action: 'DEPARTMENT_CREATE', entityName: 'department', entityId: dept.deptId, ip: req.ip });
  res.status(201).json({ data: dept });
}

// PATCH /api/departments/:id (admin)
async function update(req, res) {
  const dept = await departments.update(req.valid.params.id, req.valid.body);
  if (!dept) throw ApiError.notFound('Department not found');
  await audit.log({ actorId: req.user.id, action: 'DEPARTMENT_UPDATE', entityName: 'department', entityId: dept.deptId, ip: req.ip });
  res.json({ data: dept });
}

// DELETE /api/departments/:id (admin) - fails with 409 while alumni/students still belong to it
async function remove(req, res) {
  const { id } = req.valid.params;
  if (!(await departments.remove(id))) throw ApiError.notFound('Department not found');
  await audit.log({ actorId: req.user.id, action: 'DEPARTMENT_DELETE', entityName: 'department', entityId: id, ip: req.ip });
  res.status(204).end();
}

module.exports = { list, create, update, remove };
