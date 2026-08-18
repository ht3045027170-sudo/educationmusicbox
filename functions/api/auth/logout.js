import { json, parseCookies } from '../../_shared.js';

// POST /api/auth/logout
export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: true });
  try {
    const cookies = parseCookies(request.headers.get('cookie'));
    if (cookies.mb_sid) {
      await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(cookies.mb_sid).run();
    }
  } catch { /* 忽略错误，照样清 cookie */ }
  return json({ ok: true }, 200, {
    'set-cookie': 'mb_sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
  });
}
