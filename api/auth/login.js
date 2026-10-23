const crypto = require('node:crypto');
const { STATE_COOKIE_NAME, respondJson, setCookie } = require('../../lib/github-session');

module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return respondJson(res, 405, { error: 'Method not allowed.' });
  }
  const redirectToDashboard = (reason) => {
    res.setHeader('Cache-Control', 'no-store');
    res.writeHead(302, { Location: `/?auth=${encodeURIComponent(reason)}` });
    res.end();
  };
  const {
    GITHUB_CLIENT_ID: clientId,
    GITHUB_CLIENT_SECRET: clientSecret,
    GITHUB_OAUTH_CALLBACK_URL: callbackUrl
  } = process.env;
  if (!clientId || !clientSecret || !callbackUrl) return redirectToDashboard('configuration-error');
  try {
    const callback = new URL(callbackUrl);
    const localHttp = process.env.NODE_ENV !== 'production'
      && callback.protocol === 'http:'
      && ['localhost', '127.0.0.1'].includes(callback.hostname);
    if (callback.protocol !== 'https:' && !localHttp) return redirectToDashboard('configuration-error');
  } catch {
    return redirectToDashboard('configuration-error');
  }
  try {
    // Secret validation happens here before we send a user to GitHub.
    require('../../lib/github-session').sealSession({ accessToken: 'configuration-check', expiresAt: 1 });
  } catch {
    return redirectToDashboard('configuration-error');
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
