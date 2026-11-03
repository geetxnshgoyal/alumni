const { z, text, idParam } = require('../../utils/validators');

const deptCode = z.string().trim().toUpperCase().pipe(z.string().regex(/^[A-Z0-9]{2,20}$/, 'Code must be 2-20 letters or digits'));

const create = z.object({ deptCode, deptName: text(120, 2) });

const update = z
  .object({ deptCode: deptCode.optional(), deptName: text(120, 2).optional() })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide deptCode or deptName' });

module.exports = { create, update, idParam };
