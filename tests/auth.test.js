'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const login = require('../api/auth/login');
const callback = require('../api/auth/callback');
const { getSession, sealSession } = require('../lib/github-session');

function response() {
  const headers = {};
  return {
    headers,
    getHeader(name) { return headers[name]; },
    setHeader(name, value) { headers[name] = value; },
    writeHead(status, values = {}) { this.statusCode = status; Object.assign(headers, values); },
    end() { this.ended = true; }
  };
}

function withEnvironment(values, callbackFn) {
  const previous = {};
  const keys = ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_OAUTH_CALLBACK_URL', 'AGENTHUB_SESSION_SECRET', 'NODE_ENV'];
  for (const key of keys) {
    previous[key] = process.env[key];
    if (Object.hasOwn(values, key)) process.env[key] = values[key];
    else delete process.env[key];
  }
  try {
    return callbackFn();
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

test('OAuth login explains missing credentials before redirecting to GitHub', () => {
  withEnvironment({ GITHUB_CLIENT_ID: 'client', GITHUB_OAUTH_CALLBACK_URL: 'https://example.com/api/auth/callback' }, () => {
    const res = response();
    login({ method: 'GET' }, res);
    assert.equal(res.statusCode, 302);
    assert.equal(res.headers.Location, '/?auth=configuration-error');
    assert.equal(res.headers['Cache-Control'], 'no-store');
  });
});

test('OAuth login rejects non-HTTPS callback URLs outside localhost', () => {
  withEnvironment({
    GITHUB_CLIENT_ID: 'client',
    GITHUB_CLIENT_SECRET: 'secret',
    GITHUB_OAUTH_CALLBACK_URL: 'http://example.com/api/auth/callback',
    AGENTHUB_SESSION_SECRET: '01234567890123456789012345678901'
  }, () => {
    const res = response();
    login({ method: 'GET' }, res);
    assert.equal(res.headers.Location, '/?auth=configuration-error');
  });
});

test('OAuth login requires HTTPS callbacks in production, including localhost', () => {
  withEnvironment({
    GITHUB_CLIENT_ID: 'client',
    GITHUB_CLIENT_SECRET: 'secret',
    GITHUB_OAUTH_CALLBACK_URL: 'http://localhost:3000/api/auth/callback',
    AGENTHUB_SESSION_SECRET: '01234567890123456789012345678901',
    NODE_ENV: 'production'
  }, () => {
    const res = response();
    login({ method: 'GET' }, res);
    assert.equal(res.headers.Location, '/?auth=configuration-error');
  });
});

test('OAuth login redirects to GitHub with state when configured', () => {
  withEnvironment({
    GITHUB_CLIENT_ID: 'client',
    GITHUB_CLIENT_SECRET: 'secret',
    GITHUB_OAUTH_CALLBACK_URL: 'http://localhost:3000/api/auth/callback',
    AGENTHUB_SESSION_SECRET: '01234567890123456789012345678901'
  }, () => {
    const res = response();
    login({ method: 'GET' }, res);
    const location = new URL(res.headers.Location);
    assert.equal(location.origin, 'https://github.com');
    assert.equal(location.pathname, '/login/oauth/authorize');
    assert.equal(location.searchParams.get('client_id'), 'client');
    assert.equal(location.searchParams.get('state')?.length, 43);
    assert.match(res.headers['Set-Cookie'], /agenthub_oauth_state=/);
  });
});

test('OAuth callback returns to the dashboard when configuration is incomplete', async () => {
  await withEnvironment({}, async () => {
    const res = response();
    await callback({
      method: 'GET',
      url: '/api/auth/callback?code=code&state=state',
      headers: { cookie: 'agenthub_oauth_state=state' }
    }, res);
    assert.equal(res.statusCode, 302);
    assert.equal(res.headers.Location, '/?auth=configuration-error');
    assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.match(res.headers['Set-Cookie'], /agenthub_oauth_state=;/);
  });
});

test('encrypted sessions reject tampering and expired credentials', () => {
  withEnvironment({ AGENTHUB_SESSION_SECRET: '01234567890123456789012345678901' }, () => {
    const valid = sealSession({ accessToken: 'token', expiresAt: Date.now() + 60_000, user: { login: 'user' } });
    assert.equal(getSession({ headers: { cookie: `agenthub_session=${valid}` } }).user.login, 'user');
    const altered = `${valid.startsWith('a') ? 'b' : 'a'}${valid.slice(1)}`;
    assert.equal(getSession({ headers: { cookie: `agenthub_session=${altered}` } }), null);
    const expired = sealSession({ accessToken: 'token', expiresAt: Date.now() - 1, user: { login: 'user' } });
    assert.equal(getSession({ headers: { cookie: `agenthub_session=${expired}` } }), null);
  });
});
