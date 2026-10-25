'use strict';

const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');

const envBefore = { ...process.env };
const fetchBefore = global.fetch;
const consoleErrorBefore = console.error;

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in envBefore)) delete process.env[key];
  }
  Object.assign(process.env, envBefore);
  global.fetch = fetchBefore;
  console.error = consoleErrorBefore;
});

function response() {
  return {
    headers: {}, statusCode: 200, body: undefined, redirect: undefined,
    setHeader(name, value) { this.headers[name] = value; },
    getHeader(name) { return this.headers[name]; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    writeHead(code, headers = {}) { this.statusCode = code; Object.assign(this.headers, headers); },
    end() {}
  };
}

function loadWithExports(modulePath, overrides) {
  const dependency = require(modulePath);
  const originals = {};
  for (const [key, value] of Object.entries(overrides)) {
    originals[key] = dependency[key];
    dependency[key] = value;
  }
  const routePath = require.resolve('../api/tasks/index.js');
  delete require.cache[routePath];
  const handler = require(routePath);
  for (const [key, value] of Object.entries(originals)) dependency[key] = value;
  return handler;
}

test('session cookies are encrypted, readable, and reject tampering', () => {
  process.env.AGENTHUB_SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';
  const { sealSession, getSession } = require('../lib/github-session');
  const session = { accessToken: 'test-token', expiresAt: Date.now() + 60_000, user: { id: 17, login: 'test-user' } };
  const sealed = sealSession(session);
  assert.notEqual(sealed, JSON.stringify(session));
  assert.deepEqual(getSession({ headers: { cookie: `agenthub_session=${sealed}` } }), session);
  const tampered = `${sealed[0] === 'A' ? 'B' : 'A'}${sealed.slice(1)}`;
  assert.equal(getSession({ headers: { cookie: `agenthub_session=${tampered}` } }), null);
});

test('OAuth callback checks state, exchanges the code, and creates a session cookie', async () => {
  process.env.AGENTHUB_SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';
  process.env.GITHUB_CLIENT_ID = 'client-id';
  process.env.GITHUB_CLIENT_SECRET = 'client-secret';
  process.env.GITHUB_OAUTH_CALLBACK_URL = 'http://localhost:3000/api/auth/callback';
  const calls = [];
  global.fetch = async url => {
    calls.push(String(url));
    return calls.length === 1
      ? { ok: true, json: async () => ({ access_token: 'oauth-token', scope: 'read:user,public_repo' }) }
      : { ok: true, json: async () => ({ id: 17, login: 'test-user', name: 'Test User', avatar_url: 'https://example.test/avatar.png' }) };
  };
  const handler = require('../api/auth/callback');
  const rejected = response();
  await handler({ method: 'GET', url: '/api/auth/callback?code=auth-code&state=wrong', headers: { cookie: 'agenthub_oauth_state=expected' } }, rejected);
  assert.equal(rejected.headers.Location, '/?auth=github-error');
  assert.equal(calls.length, 0);
  const req = { method: 'GET', url: '/api/auth/callback?code=auth-code&state=expected', headers: { cookie: 'agenthub_oauth_state=expected' } };
  const res = response();
  await handler(req, res);
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, '/?auth=connected');
  assert.match(String(res.headers['Set-Cookie']), /agenthub_session=/);
  assert.equal(calls.length, 2);
});

test('same-origin validation accepts the app origin and rejects a foreign origin', () => {
  const { requireSameOrigin } = require('../lib/github-session');
  const allowed = response();
  assert.equal(requireSameOrigin({ headers: { origin: 'https://app.test', host: 'app.test' } }, allowed), true);
  const rejected = response();
  assert.equal(requireSameOrigin({ headers: { origin: 'https://attacker.test', host: 'app.test' } }, rejected), false);
  assert.equal(rejected.statusCode, 403);
});

test('logout rejects cross-origin requests before revoking a GitHub grant', async () => {
  const githubSession = require('../lib/github-session');
  const original = {
    requireSameOrigin: githubSession.requireSameOrigin,
    getSession: githubSession.getSession,
    clearCookie: githubSession.clearCookie
  };
  let checkedOrigin = false;
  let clearedCookie = false;
  githubSession.requireSameOrigin = (_req, res) => { checkedOrigin = true; res.status(403).json({ error: 'Solicitud de origen no permitido.' }); return false; };
  githubSession.getSession = () => ({ accessToken: 'test-token' });
  githubSession.clearCookie = () => { clearedCookie = true; };
  delete require.cache[require.resolve('../api/auth/logout')];
  const handler = require('../api/auth/logout');
  const calls = [];
  global.fetch = async (...args) => { calls.push(args); };
  const res = response();
  try {
    await handler({ method: 'POST', headers: { origin: 'https://attacker.test' } }, res);
  } finally {
    Object.assign(githubSession, original);
  }
  assert.equal(checkedOrigin, true);
  assert.equal(res.statusCode, 403);
  assert.equal(clearedCookie, false);
  assert.equal(calls.length, 0);
});

function taskHandler({ ensureTaskSchema = async () => {}, queryResult = [], githubFetch = async () => ({ private: false }) } = {}) {
  const calls = [];
  const sql = async (strings, ...values) => {
    calls.push({ text: strings.join('?'), values });
    return queryResult;
  };
  const db = require('../lib/database');
  const originalEnsure = db.ensureTaskSchema;
  const originalDatabase = db.database;
  db.ensureTaskSchema = ensureTaskSchema;
  db.database = () => sql;
  const handler = loadWithExports('../lib/github-session', {
    requireSession: () => ({ user: { id: 71, login: 'owner' }, accessToken: 'test-token' }),
    requireSameOrigin: (req, res) => req.headers.origin === 'https://app.test' || (res.status(403).json({ error: 'Solicitud de origen no permitido.' }), false),
    githubFetch
  });
  return { handler, calls, restore() { db.ensureTaskSchema = originalEnsure; db.database = originalDatabase; } };
}

test('task GET scopes results to the authenticated user', async () => {
  const route = taskHandler();
  const res = response();
  try {
    await route.handler({ method: 'GET', query: { repo: 'owner/project' }, headers: {} }, res);
  } finally { route.restore(); }
  assert.equal(res.statusCode, 200);
  assert.match(route.calls[0].text, /user_id = \?/);
  assert.ok(route.calls[0].values.includes(71));
  assert.ok(route.calls[0].values.includes('owner/project'));
});

test('task cancellation only updates a queued task owned by the authenticated user', async () => {
  const id = '123e4567-e89b-12d3-a456-426614174000';
  const task = { id, repository: 'owner/project', title: 'Fix issue', model: 'Claude Sonnet 4', status: 'cancelled' };
  const route = taskHandler({ queryResult: [task] });
  const res = response();
  try {
    await route.handler({ method: 'PATCH', query: { id }, headers: { origin: 'https://app.test' } }, res);
  } finally { route.restore(); }
  assert.equal(res.statusCode, 200);
  assert.match(route.calls[0].text, /user_id = \?[\s\S]*status = 'queued'/);
  assert.ok(route.calls[0].values.includes(71));
  assert.ok(route.calls[0].values.includes(id));
});

test('task routes reject requests without an authenticated user', async () => {
  const sessionModule = require('../lib/github-session');
  const original = sessionModule.requireSession;
  sessionModule.requireSession = (_req, res) => { res.status(401).json({ error: 'Sign in with GitHub to continue.' }); return null; };
  const routePath = require.resolve('../api/tasks/index.js');
  delete require.cache[routePath];
  const handler = require(routePath);
  sessionModule.requireSession = original;
  const res = response();
  await handler({ method: 'GET', query: {}, headers: {} }, res);
  assert.equal(res.statusCode, 401);
});

test('task creation requires separate nonempty title and instructions', async () => {
  const route = taskHandler();
  const res = response();
  try {
    await route.handler({ method: 'POST', headers: { origin: 'https://app.test' }, body: { title: 'Título', repository: 'owner/project', model: 'Claude Sonnet 4' } }, res);
  } finally { route.restore(); }
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /instrucciones/);
  assert.equal(route.calls.length, 0);
});

test('task creation stores the title and instructions as separate values', async () => {
  const task = { id: '123e4567-e89b-12d3-a456-426614174000', title: 'Título', status: 'queued' };
  const route = taskHandler({ queryResult: [task] });
  const res = response();
  try {
    await route.handler({
      method: 'POST',
      headers: { origin: 'https://app.test' },
      body: { title: 'Título corto', prompt: 'Instrucciones detalladas', repository: 'owner/project', model: 'Claude Sonnet 4' }
    }, res);
  } finally { route.restore(); }
  assert.equal(res.statusCode, 201);
  assert.ok(route.calls[0].values.includes('Título corto'));
  assert.ok(route.calls[0].values.includes('Instrucciones detalladas'));
});

test('unexpected task database errors are redacted from the response and sanitized in logs', async () => {
  const secretUrl = 'postgres://user:password@db.example.test/app';
  process.env.DATABASE_URL = secretUrl;
  const logs = [];
  console.error = (...args) => logs.push(args);
  const route = taskHandler({ ensureTaskSchema: async () => { throw new Error(`Database connection failed: ${secretUrl}`); } });
  const res = response();
  try {
    await route.handler({ method: 'GET', query: {}, headers: {} }, res);
  } finally { route.restore(); }
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, 'No se pudo acceder a las tareas.');
  assert.equal(JSON.stringify(res.body).includes('password'), false);
  assert.equal(JSON.stringify(logs).includes('password'), false);
  assert.match(JSON.stringify(logs), /redacted database URL/);
});

test('known missing database configuration returns a safe actionable error', async () => {
  const missingDatabase = new Error('configuration');
  missingDatabase.status = 503;
  missingDatabase.code = 'DATABASE_NOT_CONFIGURED';
  const route = taskHandler({ ensureTaskSchema: async () => { throw missingDatabase; } });
  const res = response();
  try {
    await route.handler({ method: 'GET', query: {}, headers: {} }, res);
  } finally { route.restore(); }
  assert.equal(res.statusCode, 503);
  assert.match(res.body.error, /DATABASE_URL/);
});
