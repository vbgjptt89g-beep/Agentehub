const { database, ensureTaskSchema } = require('../../lib/database');
const { githubFetch, requireSession, respondJson } = require('../../lib/github-session');
const { SUPPORTED_MODELS } = require('../../shared/constants');

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try {
    const parsed = new URL(origin);
    return parsed.host === host && (parsed.protocol === 'https:' || parsed.protocol === 'http:');
  } catch {
    return false;
  }
}

module.exports = async function handler(req, res) {
  const session = requireSession(req, res);
  if (!session) return;

  try {
    await ensureTaskSchema();
    if (req.method === 'GET') {
      const repo = typeof req.query.repo === 'string' ? req.query.repo : '';
      if (repo && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
        return respondJson(res, 400, { error: 'Repositorio no válido.' });
      }
      const sql = database();
      const tasks = repo
        ? await sql`SELECT id, repository, title, model, issue_number AS "issueNumber", status, created_at AS "createdAt", updated_at AS "updatedAt" FROM agent_tasks WHERE user_id = ${session.user.id} AND repository = ${repo} ORDER BY created_at DESC LIMIT 100`
        : await sql`SELECT id, repository, title, model, issue_number AS "issueNumber", status, created_at AS "createdAt", updated_at AS "updatedAt" FROM agent_tasks WHERE user_id = ${session.user.id} ORDER BY created_at DESC LIMIT 100`;
      res.setHeader('Cache-Control', 'no-store');
      return respondJson(res, 200, tasks);
    }
    if (req.method === 'PATCH') {
      if (!sameOrigin(req)) return respondJson(res, 403, { error: 'Solicitud de origen no permitido.' });
      const id = typeof req.query.id === 'string' ? req.query.id : '';
      if (!/^[0-9a-f-]{36}$/i.test(id)) return respondJson(res, 400, { error: 'Identificador de tarea no válido.' });
      const [task] = await database()`
        UPDATE agent_tasks SET status = 'cancelled', updated_at = NOW()
        WHERE id = ${id} AND user_id = ${session.user.id} AND status = 'queued'
        RETURNING id, repository, title, model, issue_number AS "issueNumber", status, created_at AS "createdAt", updated_at AS "updatedAt"
      `;
      if (!task) return respondJson(res, 409, { error: 'La tarea ya no está pendiente o no te pertenece.' });
      res.setHeader('Cache-Control', 'no-store');
      return respondJson(res, 200, task);
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST, PATCH');
      return respondJson(res, 405, { error: 'Method not allowed.' });
    }
    if (!sameOrigin(req)) return respondJson(res, 403, { error: 'Solicitud de origen no permitido.' });

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : title;
    const repository = typeof body.repository === 'string' ? body.repository.trim() : '';
    const model = typeof body.model === 'string' ? body.model : '';
    if (!title || title.length > 180 || !prompt || prompt.length > 8000) {
      return respondJson(res, 400, { error: 'El título y las instrucciones son obligatorios (máximo 180 y 8000 caracteres).'});
    }
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
      return respondJson(res, 400, { error: 'Selecciona un repositorio válido.' });
    }
    if (!SUPPORTED_MODELS.includes(model)) return respondJson(res, 400, { error: 'Selecciona un modelo disponible.' });

    const repo = await githubFetch(session, `/repos/${repository}`);
    if (repo.private) return respondJson(res, 403, { error: 'Esta conexión solo tiene permiso para repositorios públicos.' });
    const sql = database();
    const issueInput = typeof body.issue === 'string' ? body.issue.trim() : '';
    const issueMatch = issueInput.match(/#(\d+)|\/issues\/(\d+)/i);
    const issueNumber = issueMatch ? Number(issueMatch[1] || issueMatch[2]) : null;
    if (issueNumber) {
      await githubFetch(session, `/repos/${repository}/issues/${issueNumber}`);
    }
    const [task] = await sql`
      INSERT INTO agent_tasks (user_id, user_login, repository, title, prompt, model, issue_number)
      VALUES (${session.user.id}, ${session.user.login}, ${repository}, ${title}, ${prompt}, ${model}, ${issueNumber})
      RETURNING id, repository, title, model, issue_number AS "issueNumber", status, created_at AS "createdAt", updated_at AS "updatedAt"
    `;
    res.setHeader('Cache-Control', 'no-store');
    return respondJson(res, 201, task);
  } catch (error) {
    const status = error.status || 500;
    const message = error.status ? error.message : 'No se pudo acceder a las tareas.';
    return respondJson(res, status, { error: message || 'No se pudo acceder a las tareas.' });
  }
};

