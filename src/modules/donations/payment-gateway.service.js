const crypto = require('crypto');

const TEST_KEY_ID = process.env.PAYMENT_GATEWAY_KEY_ID || 'rzp_test_alumni2026';
const TEST_KEY_SECRET = process.env.PAYMENT_GATEWAY_KEY_SECRET || 'test_secret_key_alumni_platform_2026';

/**
 * Payment Gateway Service (Test Mode)
 * Simulates industry standard payment providers (Razorpay / Stripe)
 * with real HMAC-SHA256 signature verification.
 */
class PaymentGatewayService {
  constructor({ keyId = TEST_KEY_ID, keySecret = TEST_KEY_SECRET } = {}) {
    this.keyId = keyId;
    this.keySecret = keySecret;
  }

  /**
   * Generates a test-mode payment gateway order.
   * @param {Object} params
   * @param {number} params.amount - amount in standard currency units (e.g. INR)
   * @param {string} params.currency - currency code (default: 'INR')
   * @param {string} params.receipt - unique internal reference ID
   * @returns {Promise<{ orderId: string, amount: number, currency: string, keyId: string }>}
   */
  async createOrder({ amount, currency = 'INR', receipt }) {
    if (!amount || amount <= 0) {
      throw new Error('Order amount must be greater than zero');
    }

    const randomSuffix = crypto.randomBytes(8).toString('hex');
    const orderId = `order_test_${randomSuffix}`;

    return {
      orderId,
      amount: Math.round(amount * 100) / 100,
      currency,
      receipt: receipt ? String(receipt) : undefined,
      keyId: this.keyId,
      status: 'created',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Generates an HMAC-SHA256 signature for test-mode verification.
   * Useful for testing and mock checkout workflows.
   * @param {Object} params
   * @param {string} params.orderId
   * @param {string} params.paymentId
   * @returns {string} HMAC-SHA256 hex digest
   */
  generateSignature({ orderId, paymentId }) {
    if (!orderId || !paymentId) {
      throw new Error('Both orderId and paymentId are required to generate signature');
    }
    return crypto
      .createHmac('sha256', this.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
  }

  /**
   * Verifies the cryptographic authenticity of the payment callback signature.
   * @param {Object} params
   * @param {string} params.orderId
   * @param {string} params.paymentId
   * @param {string} params.signature
   * @returns {boolean}
   */
  verifySignature({ orderId, paymentId, signature }) {
    if (!orderId || !paymentId || !signature) {
      return false;
    }

    const expectedSignature = this.generateSignature({ orderId, paymentId });

    try {
      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      const actualBuffer = Buffer.from(signature, 'utf8');

      if (expectedBuffer.length !== actualBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Generates mock payment ID for simulation testing.
   */
  generateTestPaymentId() {
    return `pay_test_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Generates HMAC-SHA256 signature for webhook payloads.
   * @param {string|Object} payload - raw body string or JSON object
   * @param {string} secret - webhook secret (defaults to keySecret)
   * @returns {string}
   */
  generateWebhookSignature(payload, secret = this.keySecret) {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(raw).digest('hex');
  }

  /**
   * Verifies incoming webhook HMAC signature using timing-safe comparison.
   * @param {string|Object} payload
   * @param {string} signature
   * @param {string} secret
   * @returns {boolean}
   */
  verifyWebhookSignature(payload, signature, secret = this.keySecret) {
    if (!payload || !signature) return false;
    const expected = this.generateWebhookSignature(payload, secret);
    try {
      const expBuf = Buffer.from(expected, 'utf8');
      const actBuf = Buffer.from(signature, 'utf8');
      if (expBuf.length !== actBuf.length) return false;
      return crypto.timingSafeEqual(expBuf, actBuf);
    } catch {
      return false;
    }
  }
}

module.exports = new PaymentGatewayService();
