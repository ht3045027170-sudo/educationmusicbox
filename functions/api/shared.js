// 简单的 JSON 响应工具（与 omr 函数保持一致风格）
const json = (value, status = 200, extraHeaders = {}) => new Response(JSON.stringify(value), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...extraHeaders,
  },
});

// 32 字节随机 token（十六进制字符串）
const randomToken = (bytes = 32) => {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('');
};

// 通用 cookie 解析
const parseCookies = (header) => {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = decodeURIComponent(part.slice(idx + 1).trim());
    if (key) out[key] = value;
  }
  return out;
};

// 获取客户端 IP（Cloudflare 注入的）
const clientIp = (request) => request.headers.get('cf-connecting-ip') || '';

// 安全比较（防止计时攻击）
const safeEqual = (a, b) => {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

// PBKDF2-SHA256 密码哈希（10 万次迭代，符合当前业界基准）
const bytesToHex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
const hexToBytes = (h) => {
  const r = new Uint8Array(Math.floor(h.length / 2));
  for (let i = 0; i < r.length; i++) r[i] = parseInt(h.substr(i * 2, 2), 16);
  return r;
};
const pbkdf2 = async (password, saltBytes) => {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
    key, 256,
  );
  return new Uint8Array(bits);
};
const hashPassword = async (password) => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt);
  return { salt: bytesToHex(salt), hash: bytesToHex(hash) };
};
const verifyPassword = async (password, saltHex, expectedHashHex) => {
  const hash = await pbkdf2(password, hexToBytes(saltHex));
  return bytesToHex(hash) === expectedHashHex;
};

// CSRF token 校验中间件逻辑（POST/PUT/DELETE 通用）
const requireCsrf = (request, session) => {
  const headerToken = request.headers.get('x-csrf-token') || '';
  if (!session) return { ok: false, error: '请先登录后再操作。', status: 401 };
  if (!safeEqual(headerToken, session.csrf)) return { ok: false, error: '安全令牌失效，请刷新页面重试。', status: 403 };
  return { ok: true };
};

// 统一读取请求体
const readBody = async (request) => {
  const ct = (request.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) return request.json().catch(() => ({}));
  const text = await request.text().catch(() => '');
  if (!text) return {};
  if (ct.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(text));
  }
  try { return JSON.parse(text); } catch { return {}; }
};

// 设置 session cookie + 返回新会话
const issueSession = async (env, userId, request) => {
  const token = randomToken(32);
  const csrf = randomToken(24);
  const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(); // 30 天
  await env.DB.prepare(
    'INSERT INTO sessions (token, user_id, csrf, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(token, userId, csrf, expiresAt, clientIp(request), (request.headers.get('user-agent') || '').slice(0, 255)).run();
  return { token, csrf, expiresAt };
};

const cookieAttrs = (maxAgeSec = 30 * 24 * 3600) =>
  `mb_sid=${''}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}`;

export {
  json, randomToken, parseCookies, clientIp, safeEqual,
  bytesToHex, hexToBytes, hashPassword, verifyPassword, pbkdf2,
  requireCsrf, readBody, issueSession, cookieAttrs,
};
