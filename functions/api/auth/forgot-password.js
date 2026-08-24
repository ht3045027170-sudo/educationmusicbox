import { json, randomToken, readBody, verifyCsrfRequest } from '../shared.js';

// POST /api/auth/forgot-password
// body: { email }
export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: true, message: '如果该邮箱已注册，重置链接已发送。' });
  try {
    const csrfCheck = await verifyCsrfRequest(request, env);
    if (!csrfCheck.ok) return json({ ok: false, error: csrfCheck.error }, csrfCheck.status);
    const body = await readBody(request);
    const email = String(body.email || '').trim().toLowerCase();
    const product = body.learningSystem === 'gaokao' ? 'exam' : 'music';
    if (!email) return json({ ok: true }); // 不暴露邮箱是否存在
    const system = product === 'exam' ? 'gaokao' : 'hobby';
    const user = await env.DB.prepare('SELECT id, username FROM users WHERE email = ? AND learning_system = ?').bind(email, system).first();
    if (!user) return json({ ok: true, message: '如果该邮箱已注册，重置链接已发送。' });

    const token = randomToken(24);
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    await env.DB.prepare(
      "INSERT INTO sessions (token, user_id, csrf, expires_at) VALUES (?, ?, 'pending', ?)"
    ).bind('verify:' + token, user.id, expiresAt).run();

    const origin = new URL(request.url).origin;
    return json({ ok: true, username: user.username, devLink: `${origin}/?product=${product}&accountAction=reset&token=${token}` });
  } catch (error) {
    return json({ ok: true }); // 出错也不暴露敏感信息
  }
}
