import { json, parseCookies, hashPassword, issueSession, readBody, verifyCsrfRequest } from '../shared.js';

// POST /api/auth/register
// 接收 username, email, password, displayName, role（默认 learner）
// 注册成功后直接创建登录会话；邮件验证待接入正式邮件服务后再启用。

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const csrfCheck = await verifyCsrfRequest(request, env);
    if (!csrfCheck.ok) return json({ ok: false, error: csrfCheck.error }, csrfCheck.status);
    const body = await readBody(request);
    const username = String(body.username || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const displayName = String(body.displayName || username || '').trim();
    // 安全：公开注册一律为 learner，teacher/admin 由管理员在数据库中手动授权
    const role = 'learner';
    const learningSystem = String(body.learningSystem || body.system || 'hobby');

    if (!username || username.length < 2 || username.length > 40) {
      return json({ ok: false, error: '用户名长度需在 2-40 字符之间。' }, 400);
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ ok: false, error: '邮箱格式不正确。' }, 400);
    }
    if (password.length < 10) {
      return json({ ok: false, error: '密码至少 10 位，请用大小写字母加数字组合。' }, 400);
    }
    if (!['hobby', 'gaokao'].includes(learningSystem)) {
      return json({ ok: false, error: '注册产品无效。' }, 400);
    }

    const exists = await env.DB.prepare(
      'SELECT id FROM users WHERE username = ? OR email = ?'
    ).bind(username, email).first();
    if (exists) return json({ ok: false, error: '该用户名或邮箱已被注册，可直接登录两个系统。' }, 409);

    const { salt, hash } = await hashPassword(password);
    const result = await env.DB.prepare(
      'INSERT INTO users (username, email, password_hash, password_salt, display_name, role, learning_system) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(username, email, hash, salt, displayName, role, learningSystem).run();
    const userId = result.meta.last_row_id;

    const cookies = parseCookies(request.headers.get('cookie'));
    if (cookies.mb_sid) {
      await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(cookies.mb_sid).run();
    }
    const session = await issueSession(env, userId, request);
    return json({
      ok: true,
      user: {
        id: userId,
        username,
        email,
        displayName,
        role,
        learningSystem,
        status: 'active',
        emailVerified: false,
        profiles: {},
      },
      csrfToken: session.csrf,
    }, 200, {
      'set-cookie': `mb_sid=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}`,
    });
  } catch (error) {
    return json({ ok: false, error: '注册失败：' + (error.message || String(error)) }, 500);
  }
}
