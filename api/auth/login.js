const crypto = require('node:crypto');
const { STATE_COOKIE_NAME, respondJson, setCookie } = require('../../lib/github-session');

module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return respondJson(res, 405, { error: 'Method not allowed.' });
  }
  const { GITHUB_CLIENT_ID: clientId, GITHUB_OAUTH_CALLBACK_URL: callbackUrl } = process.env;
  if (!clientId || !callbackUrl) return respondJson(res, 503, { error: 'GitHub OAuth is not configured. Add GITHUB_CLIENT_ID and GITHUB_OAUTH_CALLBACK_URL.' });
  try {
    // Secret validation happens here before we send a user to GitHub.
    require('../../lib/github-session').sealSession({ accessToken: 'configuration-check', expiresAt: 1 });
  } catch (error) {
    return respondJson(res, 503, { error: error.message });
  }
  const state = crypto.randomBytes(32).toString('base64url');
  setCookie(res, STATE_COOKIE_NAME, state, 600);
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', callbackUrl);
  url.searchParams.set('scope', 'read:user,public_repo');
  url.searchParams.set('state', state);
  res.setHeader('Cache-Control', 'no-store');
  res.writeHead(302, { Location: url.toString() });
  res.end();
};
