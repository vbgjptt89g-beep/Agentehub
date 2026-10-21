const { clearCookie, COOKIE_NAME, getSession, respondJson } = require('../../lib/github-session');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return respondJson(res, 405, { error: 'Method not allowed.' });
  }
  const session = getSession(req);
  const { GITHUB_CLIENT_ID: clientId, GITHUB_CLIENT_SECRET: clientSecret } = process.env;
  if (session && clientId && clientSecret) {
    try {
      await fetch(`https://api.github.com/applications/${encodeURIComponent(clientId)}/grant`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'AgentHub'
        },
        body: JSON.stringify({ access_token: session.accessToken })
      });
    } catch {
      // Always clear the local session, even if GitHub is temporarily unavailable.
    }
  }
  clearCookie(res, COOKIE_NAME);
  res.setHeader('Cache-Control', 'no-store');
  res.writeHead(303, { Location: '/' });
  res.end();
};

