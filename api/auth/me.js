const { clearCookie, COOKIE_NAME, getSession, requireGet, respondJson } = require('../../lib/github-session');

module.exports = function handler(req, res) {
  if (!requireGet(req, res)) return;
  const session = getSession(req);
  if (!session) {
    clearCookie(res, COOKIE_NAME);
    return respondJson(res, 200, { authenticated: false });
  }
  respondJson(res, 200, {
    authenticated: true,
    user: session.user,
    scopes: session.scope.split(',').filter(Boolean)
  });
};
