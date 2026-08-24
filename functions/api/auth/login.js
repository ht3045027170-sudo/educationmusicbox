import { json, parseCookies, verifyPassword, readBody, verifyCsrfRequest } from '../shared.js';

// POST /api/auth/login
// body: { email, password, learningSystem? }
export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const csrfCheck = await verifyCsrfRequest(request, env);
    if (!csrfCheck.ok) return json({ ok: false, error: csrfCheck.error }, csrfCheck.status);
    const body = await readBody(request);
    const identifier = String(body.email || body.username || '').trim();
    const password = String(body.password || '');
    const system = String(body.learningSystem || body.system || 'hobby').trim();
    if (!identifier || !password) {
      return json({ ok: false, error: '请输入账号（邮箱或用户名）和密码。' }, 400);
    }
    if (!['hobby', 'gaokao'].includes(system)) {
      return json({ ok: false, error: '账号所属产品无效。' }, 400);
    }
    const user = await env.DB.prepare(
      'SELECT id, username, email, display_name, role, learning_system, status, email_verified, password_hash, password_salt, created_at, profiles_json FROM users WHERE (email = ? OR username = ?) AND learning_system = ? LIMIT 1'
    ).bind(identifier, identifier, system).first();
    if (!user) return json({ ok: false, error: '账号或密码错误。' }, 401);
    if (user.status !== 'active') return json({ ok: false, error: '该账号已被停用，请联系管理员。' }, 403);
    const ok = await verifyPassword(password, user.password_salt, user.password_hash);
    if (!ok) return json({ ok: false, error: '账号或密码错误。' }, 401);

    // 清掉旧的 session（多半是匿名 csrf 占位的）再为这个用户开新 session
    const cookies = parseCookies(request.headers.get('cookie'));
    if (cookies.mb_sid) {
      await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(cookies.mb_sid).run();
    }
    const csrf = randomTokenString(24);
    const token = randomTokenString(32);
    const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    await env.DB.prepare(
      'INSERT INTO sessions (token, user_id, csrf, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(token, user.id, csrf, expiresAt, request.headers.get('cf-connecting-ip') || '', (request.headers.get('user-agent') || '').slice(0, 255)).run();

    await env.DB.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').bind(user.id).run();

    let profiles = {};
    try { profiles = JSON.parse(user.profiles_json || '{}'); } catch {}

    return json({
      user: {
        id: user.id, username: user.username, email: user.email,
        displayName: user.display_name, role: user.role,
        learningSystem: user.learning_system, status: user.status,
        emailVerified: !!user.email_verified, createdAt: user.created_at,
        profiles,
      },
      csrfToken: csrf,
    }, 200, {
      'set-cookie': `mb_sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}`,
    });
  } catch (error) {
    return json({ ok: false, error: '登录失败：' + (error.message || String(error)) }, 500);
  }
}

function randomTokenString(bytes = 32) {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('');
}
