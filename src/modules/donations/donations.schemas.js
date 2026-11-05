const { z, id, idParam, pagination, text, optionalText } = require('../../utils/validators');

const gatewayEnum = z.enum(['RAZORPAY', 'STRIPE']);
const statusEnum = z.enum(['INITIATED', 'SUCCESS', 'FAILED']);

const createOrder = z.object({
  campaignId: id,
  amount: z
    .coerce
    .number()
    .min(10, 'Minimum donation amount is ₹10')
    .max(10000000, 'Maximum single donation amount is ₹1,00,00,000'),
  currency: z.enum(['INR', 'USD']).default('INR'),
  isAnonymous: z.boolean().default(false),
  gateway: gatewayEnum.default('RAZORPAY'),
});

const verifyPayment = z.object({
  donationId: id,
  gatewayOrderId: text(100, 5),
  gatewayPaymentId: text(100, 5),
  signature: text(255, 10),
});

const recordFailure = z.object({
  donationId: id,
  gatewayOrderId: text(100, 5),
  reason: optionalText(255),
});

const listQuery = z.object({
  campaignId: id.optional(),
  status: statusEnum.optional(),
  ...pagination,
});

module.exports = {
  createOrder,
  verifyPayment,
  recordFailure,
  listQuery,
  idParam,
};
