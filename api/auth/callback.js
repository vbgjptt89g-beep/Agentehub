const {
  COOKIE_NAME, SESSION_TTL, STATE_COOKIE_NAME, clearCookie, readCookies,
  respondJson, sealSession, setCookie
} = require('../../lib/github-session');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return respondJson(res, 405, { error: 'Method not allowed.' });
  }
  const query = new URL(req.url, 'http://localhost').searchParams;
  const cookies = readCookies(req);
  const state = query.get('state');
  const code = query.get('code');
  const fail = (reason) => {
    clearCookie(res, STATE_COOKIE_NAME);
    res.writeHead(302, { Location: `/?auth=${encodeURIComponent(reason)}` });
    res.end();
  };
  if (query.has('error') || !code || !state || !cookies[STATE_COOKIE_NAME] || state !== cookies[STATE_COOKIE_NAME]) return fail('github-error');
  const { GITHUB_CLIENT_ID: clientId, GITHUB_CLIENT_SECRET: clientSecret, GITHUB_OAUTH_CALLBACK_URL: callbackUrl } = process.env;
  if (!clientId || !clientSecret || !callbackUrl) return respondJson(res, 503, { error: 'GitHub OAuth is not fully configured.' });

  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: callbackUrl, state })
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || tokenData.error || !tokenData.access_token) return fail('github-error');
    const profileResponse = await fetch('https://api.github.com/user', {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${tokenData.access_token}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'AgentHub' }
    });
    if (!profileResponse.ok) return fail('github-error');
    const profile = await profileResponse.json();
    const session = {
      accessToken: tokenData.access_token,
      scope: tokenData.scope || '',
      expiresAt: Date.now() + SESSION_TTL * 1000,
      user: { login: profile.login, avatarUrl: profile.avatar_url, name: profile.name || profile.login }
    };
    setCookie(res, COOKIE_NAME, sealSession(session), SESSION_TTL);
    clearCookie(res, STATE_COOKIE_NAME);
    res.setHeader('Cache-Control', 'no-store');
    res.writeHead(302, { Location: '/?auth=connected' });
    res.end();
  } catch {
    fail('github-error');
  }
};

