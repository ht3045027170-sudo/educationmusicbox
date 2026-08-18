import { json, verifyCsrfRequest } from '../shared.js';

// POST /api/admin/logout
// 管理后台退出：删除当前会话并清除 Cookie（与主站退出等价）
export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: true });
  try {
    const check = await verifyCsrfRequest(request, env);
    if (check.ok) {
      await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(check.sid).run();
    }
  } catch (err) { /* 会话可能已失效，直接视为退出成功 */ }
  return json({ ok: true }, 200, {
    'set-cookie': 'mb_sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
  });
}
