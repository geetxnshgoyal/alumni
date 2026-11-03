// Converts ?page & ?limit into SQL LIMIT/OFFSET values and builds the response metadata.
function toLimitOffset({ page, limit }) {
  return { limit, offset: (page - 1) * limit };
}

function paginationMeta({ page, limit }, total) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

module.exports = { toLimitOffset, paginationMeta };
