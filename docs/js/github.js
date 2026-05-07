// Register a GitHub OAuth App (no callback URL needed) and paste the client_id here.
// Settings → Developer settings → OAuth Apps → New OAuth App
export const GITHUB_CLIENT_ID = 'Ov23li98yZBOz7fDw06q';

const ORG = 'star-assets';
const MODEL_REPOS = ['models-a', 'models-b', 'models-c', 'models-d'];
const TEXTURE_REPOS = ['textures-a', 'textures-b', 'textures-c', 'textures-d', 'textures-e', 'textures-f', 'textures-g', 'textures-h'];
const CACHE_TTL = 24 * 60 * 60 * 1000;

// ── Token ─────────────────────────────────────────────────────────────────────

export function getToken() {
  return localStorage.getItem('gh_token') ?? '';
}

export function setToken(token) {
  if (token) localStorage.setItem('gh_token', token);
  else localStorage.removeItem('gh_token');
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Raw URL ───────────────────────────────────────────────────────────────────

export function rawUrl(repo, filename) {
  return `https://raw.githubusercontent.com/${ORG}/${repo}/HEAD/${encodeURIComponent(filename)}`;
}

// ── Cache ─────────────────────────────────────────────────────────────────────

function cacheGet(key) {
  try {
    const item = localStorage.getItem(`gh_${key}`);
    if (!item) return null;
    const { ts, data } = JSON.parse(item);
    return Date.now() - ts < CACHE_TTL ? data : null;
  } catch { return null; }
}

function cacheSet(key, data) {
  try { localStorage.setItem(`gh_${key}`, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchTree(repo, onProgress) {
  const res = await fetch(
    `https://api.github.com/repos/${ORG}/${repo}/git/trees/HEAD?recursive=1`,
    { headers: authHeaders() }
  );
  onProgress?.();
  if (!res.ok) {
    if (res.status === 403 || res.status === 429) throw new Error('rate_limit');
    return [];
  }
  const { tree } = await res.json();
  return tree.filter(f => f.type === 'blob').map(f => f.path);
}

export async function fetchModelList(onProgress) {
  const cached = cacheGet('models');
  if (cached) return cached;

  const models = [];
  for (const repo of MODEL_REPOS) {
    const files = await fetchTree(repo, onProgress);
    for (const f of files) {
      if (f.endsWith('.m3')) models.push({ name: f, repo });
    }
  }
  cacheSet('models', models);
  return models;
}

export async function buildTextureIndex(onProgress) {
  const cached = cacheGet('textures');
  if (cached) return cached;

  const index = {};
  for (const repo of TEXTURE_REPOS) {
    const files = await fetchTree(repo, onProgress);
    for (const f of files) index[f.toLowerCase()] = { repo, name: f };
  }
  cacheSet('textures', index);
  return index;
}

export function makeTextureResolver(textureIndex) {
  return (filename) => {
    if (!filename) return null;
    const entry = textureIndex[filename.toLowerCase()];
    return entry ? rawUrl(entry.repo, entry.name) : null;
  };
}

export function clearCache() {
  ['models', 'textures'].forEach(k => localStorage.removeItem(`gh_${k}`));
}

// ── CORS proxy helper ─────────────────────────────────────────────────────────

// corsproxy.io correct format: prepend https://corsproxy.io/? directly to URL
async function corsPost(url, body) {
  const init = {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
  const enc = encodeURIComponent(url);
  // Try two corsproxy.io URL formats (format changed between versions)
  for (const proxy of [`https://corsproxy.io/?${enc}`, `https://corsproxy.io/?url=${enc}`]) {
    try {
      const res = await fetch(proxy, init);
      if (res.status !== 404 && res.status !== 502 && res.status !== 503) return res;
    } catch {}
  }
  const err = new Error('CORS proxy unavailable — check your network connection');
  err.proxyFailed = true;
  throw err;
}

// ── Device Flow OAuth ─────────────────────────────────────────────────────────

/**
 * Starts GitHub Device Flow. Returns an async iterator that yields:
 *   { step: 'code', userCode, verificationUri }   — show code to user
 *   { step: 'done', token }                        — show code to user
 *   { step: 'error', message }                     — something went wrong
 *
 * Pass an AbortSignal to cancel polling.
 */
export async function* startDeviceFlow(signal) {
  if (!GITHUB_CLIENT_ID) {
    yield { step: 'error', message: 'GITHUB_CLIENT_ID not set in github.js' };
    return;
  }

  const codeRes = await corsPost('https://github.com/login/device/code',
    { client_id: GITHUB_CLIENT_ID, scope: '' });
  if (!codeRes.ok) {
    yield { step: 'error', message: `Device code request failed: ${codeRes.status}` };
    return;
  }

  const { device_code, user_code, verification_uri, expires_in, interval } = await codeRes.json();
  yield { step: 'code', userCode: user_code, verificationUri: verification_uri };

  const pollMs = (interval ?? 5) * 1000;
  const expiresAt = Date.now() + (expires_in ?? 900) * 1000;

  while (Date.now() < expiresAt) {
    if (signal?.aborted) return;
    await new Promise(r => setTimeout(r, pollMs));
    if (signal?.aborted) return;

    const tokenRes = await corsPost('https://github.com/login/oauth/access_token', {
      client_id: GITHUB_CLIENT_ID,
      device_code,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });

    const data = await tokenRes.json();
    if (data.access_token) {
      setToken(data.access_token);
      yield { step: 'done', token: data.access_token };
      return;
    }
    if (data.error === 'access_denied' || data.error === 'expired_token') {
      yield { step: 'error', message: data.error };
      return;
    }
    // authorization_pending or slow_down — keep polling
  }

  yield { step: 'error', message: 'Device flow expired' };
}