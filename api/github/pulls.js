const { githubFetch, requireGet, requireSession, respondJson } = require('../../lib/github-session');

module.exports = async function handler(req, res) {
  if (!requireGet(req, res)) return;
  const session = requireSession(req, res);
  if (!session) return;
  const fullName = String(req.query.repo || '');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(fullName) || fullName.split('/').some(part => part === '.' || part === '..')) return respondJson(res, 400, { error: 'Provide a repository in owner/name format.' });
  try {
    const pulls = await githubFetch(session, `/repos/${fullName}/pulls?state=open&sort=updated&per_page=100`);
    respondJson(res, 200, pulls.map(pull => ({
      number: pull.number,
      title: pull.title,
      state: pull.state,
      draft: pull.draft,
      head: pull.head.ref,
      base: pull.base.ref,
      updatedAt: pull.updated_at,
      htmlUrl: pull.html_url,
      user: pull.user?.login
    })));
  } catch (error) {
    respondJson(res, error.status || 502, { error: error.message });
  }
};
