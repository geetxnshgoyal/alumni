// Reusable zod building blocks shared by every module's *.schemas.js file.
const { z } = require('zod');

const emptyToUndefined = (v) => (v === '' || v === null ? undefined : v);
const emptyToNull = (v) => (v === '' ? null : v);

// Required text with trimming and a max length.
const text = (max, min = 1) => z.string().trim().min(min).max(max);

// Optional query-string text: `?city=` is treated as "not provided".
const optionalText = (max) => z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

// Optional body field that may be cleared: "" or null -> null.
const nullableText = (max) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional());

// Only http(s) links, so stored URLs can never become `javascript:` links in the UI.
const httpUrl = z.url({ protocol: /^https?$/, message: 'Must be a valid http(s) URL' }).max(500);
const nullableUrl = z.preprocess(emptyToNull, httpUrl.nullable().optional());

const id = z.coerce.number().int().positive();
const idParam = z.object({ id });

const optionalInt = (min, max) =>
  z.preprocess(emptyToUndefined, z.coerce.number().int().min(min).max(max).optional());

const email = z.string().trim().toLowerCase().pipe(z.email('Must be a valid email').max(255));

// bcrypt only uses the first 72 bytes, so cap the length there.
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

const phone = z.preprocess(
  emptyToNull,
  z.string().trim().regex(/^\+?[0-9]{7,15}$/, 'Phone must be 7-15 digits, optionally starting with +').nullable().optional()
);

const tagList = z.array(text(60)).max(20).optional();

const pagination = {
  page: optionalInt(1, 100000).default(1),
  limit: optionalInt(1, 100).default(20),
};

module.exports = { z, text, optionalText, nullableText, httpUrl, nullableUrl, id, idParam, optionalInt, email, password, phone, tagList, pagination };
