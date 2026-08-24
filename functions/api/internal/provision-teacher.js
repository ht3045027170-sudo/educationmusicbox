import { json, safeEqual } from '../../shared.js';

const ONE_TIME_TOKEN_HASH = '9e73a62bee1f64b334a0d9fefaa6e6f9da8638572e599229332b562c44c60a17';

const sha256 = async (value) => {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
};

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false, error: '数据库未配置。' }, 503);
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token || !safeEqual(await sha256(token), ONE_TIME_TOKEN_HASH)) {
    return json({ ok: false, error: '未授权。' }, 401);
  }

  const result = await env.DB.prepare(
    "UPDATE users SET display_name = '何老师', role = 'teacher', learning_system = 'gaokao', email_verified = 1, status = 'active' WHERE email = ?"
  ).bind('3045027170@qq.com').run();
  return json({ ok: true, changed: result.meta.changes || 0 });
}
