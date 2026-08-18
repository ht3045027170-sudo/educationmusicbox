import { json, parseCookies, safeEqual, readBody } from '../../../shared.js';

// PUT /api/auth/systems/:code/profile
// body: { profile: { ... } }
export async function onRequestPut(context) {
  const { request, env, params } = context;
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  const code = String(params?.code || '').trim();
  if (!['hobby', 'gaokao'].includes(code)) {
    return json({ ok: false, error: '未知的系统代码：' + code }, 400);
  }
  try {
    // CSRF + 登录校验
    const cookies = parseCookies(request.headers.get('cookie'));
    const sid = cookies.mb_sid;
    if (!sid) return json({ ok: false, error: '请先登录。' }, 401);
    const headerToken = request.headers.get('x-csrf-token') || '';
    const session = await env.DB.prepare(
      'SELECT user_id, csrf, expires_at FROM sessions WHERE token = ?'
    ).bind(sid).first();
    if (!session) return json({ ok: false, error: '会话无效，请重新登录。' }, 401);
    if (new Date(session.expires_at).getTime() < Date.now()) {
      await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(sid).run();
      return json({ ok: false, error: '会话已过期，请重新登录。' }, 401);
    }
    if (!safeEqual(headerToken, session.csrf)) {
      return json({ ok: false, error: '安全令牌失效，请刷新页面重试。' }, 403);
    }

    const body = await readBody(request);
    const profile = body.profile || {};
    const user = await env.DB.prepare('SELECT profiles_json FROM users WHERE id = ?').bind(session.user_id).first();
    let profiles = {};
    try { profiles = JSON.parse(user?.profiles_json || '{}'); } catch {}
    profiles[code] = { ...(profiles[code] || {}), ...profile };
    await env.DB.prepare('UPDATE users SET profiles_json = ? WHERE id = ?')
      .bind(JSON.stringify(profiles), session.user_id).run();
    return json({ ok: true, profile: profiles[code] });
  } catch (error) {
    return json({ ok: false, error: '保存档案失败：' + (error.message || String(error)) }, 500);
  }
}
