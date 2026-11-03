// Builds "SET col1 = $1, col2 = $2" from an object of camelCase fields.
// `columns` maps allowed camelCase keys to real column names, so user input can never choose a column.
function buildSet(fields, columns, startIndex = 1) {
  const sets = [];
  const values = [];
  for (const [key, column] of Object.entries(columns)) {
    if (fields[key] === undefined) continue;
    values.push(fields[key]);
    sets.push(`${column} = $${startIndex + values.length - 1}`);
  }
  return { sql: sets.join(', '), values };
}

// Escapes % and _ so user search text is matched literally inside ILIKE patterns.
const likePattern = (value) => `%${value.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

module.exports = { buildSet, likePattern };
