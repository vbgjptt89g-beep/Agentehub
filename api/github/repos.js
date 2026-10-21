const { githubFetch, requireGet, requireSession, respondJson } = require('../../lib/github-session');

module.exports = async function handler(req, res) {
  if (!requireGet(req, res)) return;
  const session = requireSession(req, res);
  if (!session) return;
  try {
    const repos = await githubFetch(session, '/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member');
    respondJson(res, 200, repos.map(repo => ({
      id: repo.id,
      fullName: repo.full_name,
      name: repo.name,
      owner: repo.owner.login,
      private: repo.private,
      description: repo.description,
      defaultBranch: repo.default_branch,
      updatedAt: repo.updated_at,
      openIssuesCount: repo.open_issues_count,
      htmlUrl: repo.html_url,
      permissions: repo.permissions
    })));
  } catch (error) {
    respondJson(res, error.status || 502, { error: error.message });
  }
};
