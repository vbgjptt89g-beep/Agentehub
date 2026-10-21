const { githubFetch, requireGet, requireSession, respondJson } = require('../../lib/github-session');

module.exports = async function handler(req, res) {
  if (!requireGet(req, res)) return;
  const session = requireSession(req, res);
  if (!session) return;
  const fullName = String(req.query.repo || '');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(fullName) || fullName.split('/').some(part => part === '.' || part === '..')) return respondJson(res, 400, { error: 'Provide a repository in owner/name format.' });
  try {
    const branches = await githubFetch(session, `/repos/${fullName}/branches?per_page=100`);
    respondJson(res, 200, branches.map(branch => ({ name: branch.name, sha: branch.commit.sha, protected: branch.protected })));
  } catch (error) {
    respondJson(res, error.status || 502, { error: error.message });
  }
};
