import { json, randomToken, readBody } from '../../_shared.js';

// POST /api/auth/verify-email
// body: { token }
export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const body = await readBody(request);
    const token = String(body.token || '');
    if (!token) return json({ ok: false, error: '缺少验证 token。' }, 400);
    const row = await env.DB.prepare(
      "SELECT user_id FROM sessions WHERE token = ? AND csrf = 'pending'"
    ).bind('verify:' + token).first();
    if (!row) return json({ ok: false, error: '验证链接无效或已过期，请重新申请。' }, 400);
    await env.DB.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').bind(row.user_id).run();
    await env.DB.prepare("DELETE FROM sessions WHERE token = ? AND csrf = 'pending'").bind('verify:' + token).run();
    return json({ ok: true, message: '邮箱已验证，可以登录了。' });
  } catch (error) {
    return json({ ok: false, error: '验证失败：' + (error.message || String(error)) }, 500);
  }
}
