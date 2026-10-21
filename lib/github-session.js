const crypto = require('node:crypto');

const COOKIE_NAME = 'agenthub_session';
const STATE_COOKIE_NAME = 'agenthub_oauth_state';
const SESSION_TTL = 60 * 60 * 24 * 14;
let sessionKey;

function secretKey() {
  const secret = process.env.AGENTHUB_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('AGENTHUB_SESSION_SECRET must contain at least 32 characters.');
  if (!sessionKey) sessionKey = crypto.createHash('sha256').update(secret).digest();
  return sessionKey;
}

function cookieOptions(maxAge) {
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

function appendCookie(res, value) {
  const current = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', current ? [...(Array.isArray(current) ? current : [current]), value] : value);
}

function setCookie(res, name, value, maxAge) {
  appendCookie(res, `${name}=${value}; ${cookieOptions(maxAge)}`);
}

function clearCookie(res, name) {
  appendCookie(res, `${name}=; ${cookieOptions(0)}`);
}

function readCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(part => {
    const index = part.indexOf('=');
    return index < 0 ? ['', ''] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }).filter(([name]) => name));
}

function sealSession(session) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(session)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
}

function openSession(value) {
  if (!value || value.length > 4096) return null;
  try {
    const packed = Buffer.from(value, 'base64url');
    if (packed.length < 29) return null;
    const iv = packed.subarray(0, 12);
    const tag = packed.subarray(12, 28);
    const ciphertext = packed.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey(), iv);
    decipher.setAuthTag(tag);
    const data = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    const session = JSON.parse(data);
    if (!session.accessToken || !session.expiresAt || session.expiresAt < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

function getSession(req) {
  const cookies = readCookies(req);
  return openSession(cookies[COOKIE_NAME]);
}

function respondJson(res, status, payload) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(status).json(payload);
}

async function githubFetch(session, path) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${session.accessToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'AgentHub'
    },
    cache: 'no-store'
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || 'GitHub API request failed.');
    error.status = response.status;
    throw error;
  }
  return data;
}

function requireGet(req, res) {
  if (req.method === 'GET') return true;
  res.setHeader('Allow', 'GET');
  respondJson(res, 405, { error: 'Method not allowed.' });
  return false;
}

function requireSession(req, res) {
  const session = getSession(req);
  if (session) return session;
  respondJson(res, 401, { error: 'Sign in with GitHub to continue.' });
  return null;
}

module.exports = {
  COOKIE_NAME, STATE_COOKIE_NAME, SESSION_TTL, appendCookie, clearCookie,
  getSession, githubFetch, readCookies, requireGet, requireSession, respondJson,
  sealSession, setCookie
};
