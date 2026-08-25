import { json, randomToken, readBody, verifyCsrfRequest } from '../shared.js';

// POST /api/auth/resend-verification
// body: { email }
export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: true, message: '如果该邮箱存在且尚未验证，邮件已经发送。' });
  try {
    const csrfCheck = await verifyCsrfRequest(request, env);
    if (!csrfCheck.ok) return json({ ok: false, error: csrfCheck.error }, csrfCheck.status);
    const body = await readBody(request);
    const email = String(body.email || '').trim().toLowerCase();
    const product = body.learningSystem === 'gaokao' ? 'exam' : 'music';
    if (!email) return json({ ok: true });
    const user = await env.DB.prepare('SELECT id, email_verified FROM users WHERE email = ?').bind(email).first();
    if (!user || user.email_verified) {
      return json({ ok: true, message: '如果该邮箱存在且尚未验证，邮件已经发送。' });
    }
    const token = randomToken(24);
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    await env.DB.prepare(
      "INSERT INTO sessions (token, user_id, csrf, expires_at) VALUES (?, ?, 'pending', ?)"
    ).bind('verify:' + token, user.id, expiresAt).run();
    const origin = new URL(request.url).origin;
    return json({ ok: true, devLink: `${origin}/?product=${product}&accountAction=verify&token=${token}` });
  } catch (error) {
    return json({ ok: true, message: '如果该邮箱存在且尚未验证，邮件已经发送。' });
  }
}
