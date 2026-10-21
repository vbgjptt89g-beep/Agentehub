const { githubFetch, requireGet, requireSession, respondJson } = require('../../lib/github-session');

module.exports = async function handler(req, res) {
  if (!requireGet(req, res)) return;
  const session = requireSession(req, res);
  if (!session) return;
  const fullName = String(req.query.repo || '');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(fullName) || fullName.split('/').some(part => part === '.' || part === '..')) return respondJson(res, 400, { error: 'Provide a repository in owner/name format.' });
  try {
    const issues = await githubFetch(session, `/repos/${fullName}/issues?state=open&sort=updated&per_page=100`);
    respondJson(res, 200, issues.filter(item => !item.pull_request).map(issue => ({
      number: issue.number,
      title: issue.title,
      state: issue.state,
      labels: issue.labels.map(label => label.name),
      updatedAt: issue.updated_at,
      htmlUrl: issue.html_url,
      user: issue.user?.login
    })));
  } catch (error) {
    respondJson(res, error.status || 502, { error: error.message });
  }
};
