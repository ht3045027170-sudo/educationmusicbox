import { json, randomToken, parseCookies, issueSession } from '../_shared.js';

// GET /api/csrf
// 1. 如果有 session cookie 复用则返回现有 csrf token
// 2. 否则新建匿名/游客 session 并下发 csrf
export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const cookies = parseCookies(request.headers.get('cookie'));
    const sid = cookies.mb_sid;
    let csrf = '';
    if (sid) {
      const row = await env.DB.prepare('SELECT csrf, expires_at FROM sessions WHERE token = ?').bind(sid).first();
      if (row && new Date(row.expires_at).getTime() > Date.now()) {
        csrf = row.csrf;
      }
    }
    if (!csrf) {
      // 没有有效 session，创建一个匿名 session（不绑定用户，后面登录会替换）
      csrf = randomToken(24);
      const token = randomToken(32);
      const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
      await env.DB.prepare(
        'INSERT INTO sessions (token, user_id, csrf, expires_at) VALUES (?, 0, ?, ?)'
      ).bind(token, csrf, expiresAt).run();
      return json({ csrfToken: csrf, anonymous: true }, 200, {
        'set-cookie': `mb_sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}`,
      });
    }
    return json({ csrfToken: csrf, anonymous: !cookies.mb_sid });
  } catch (error) {
    return json({ ok: false, error: '生成安全令牌失败：' + (error.message || String(error)) }, 500);
  }
}
