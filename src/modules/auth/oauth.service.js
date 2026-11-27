const crypto = require('crypto');
const env = require('../../config/env');
const ApiError = require('../../utils/ApiError');

/**
 * OAuth 2.0 and OpenID Connect (OIDC) Service (Lecture 16 Slides 17-21)
 * Handles Google OAuth authorization URL creation, token exchange,
 * and OIDC ID-token identity proof verification.
 */

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

/**
 * Generates Google OAuth 2.0 Authorization URL with CSRF protection state.
 */
function getGoogleAuthUrl({ state, redirectUri = env.GOOGLE_CALLBACK_URL }) {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: state || crypto.randomBytes(16).toString('hex'),
    access_type: 'offline',
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * Verifies and parses Google OIDC identity proof (ID Token or Credential JWT).
 * Supports test mode for offline development, CI/CD, and demo evaluations.
 */
async function verifyGoogleIdentity({ idToken, code }) {
  // 1. Simulation mode for tests and local demos only. It trusts whatever email the token names,
  // so it must be opt-in and can never run in production (that would let anyone log in as anyone).
  const mockAllowed =
    env.NODE_ENV !== 'production' && (env.NODE_ENV === 'test' || process.env.MOCK_OAUTH === 'true');
  if (mockAllowed) {
    const rawSubject = idToken || code || 'test_sub_default';
    const emailMatch = rawSubject.match(/email=([^&;]+)/);
    const nameMatch = rawSubject.match(/name=([^&;]+)/);
    const subMatch = rawSubject.match(/sub=([^&;]+)/);

    const email = (emailMatch ? decodeURIComponent(emailMatch[1]) : 'google.user@example.com').toLowerCase();
    const fullName = nameMatch ? decodeURIComponent(nameMatch[1]) : 'Google Verified Alum';
    const googleId = subMatch ? decodeURIComponent(subMatch[1]) : `google_${crypto.createHash('md5').update(email).digest('hex')}`;

    return {
      googleId,
      email,
      fullName,
      avatarUrl: `https://lh3.googleusercontent.com/a/mock-${googleId.slice(0, 8)}`,
      emailVerified: true,
      provider: 'GOOGLE',
    };
  }

  // 2. Real Google OAuth Token Exchange if code was provided
  if (code) {
    try {
      const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: env.GOOGLE_CALLBACK_URL,
          grant_type: 'authorization_code',
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Google token exchange failed: ${errText}`);
      }

      const tokenData = await response.json();
      idToken = tokenData.id_token;
    } catch (err) {
      throw ApiError.badRequest(`OAuth token exchange failed: ${err.message}`);
    }
  }

  // 3. Verify Google ID token via Google TokenInfo API
  if (!idToken) {
    throw ApiError.badRequest('Either idToken or authorization code is required for Google login');
  }

  try {
    const tokenInfoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );

    if (!tokenInfoRes.ok) {
      throw new Error('Google token signature verification failed');
    }

    const payload = await tokenInfoRes.json();

    if (payload.aud !== env.GOOGLE_CLIENT_ID) {
      throw new Error('Google token audience does not match this application client ID');
    }

    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase(),
      fullName: payload.name || payload.email.split('@')[0],
      avatarUrl: payload.picture || null,
      emailVerified: payload.email_verified === 'true' || payload.email_verified === true,
      provider: 'GOOGLE',
    };
  } catch (err) {
    throw ApiError.unauthorized(`Invalid Google identity proof: ${err.message}`);
  }
}

module.exports = {
  getGoogleAuthUrl,
  verifyGoogleIdentity,
};
