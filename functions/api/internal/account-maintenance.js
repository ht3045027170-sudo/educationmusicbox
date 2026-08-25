import { json, safeEqual } from '../shared.js';

const TOKEN_HASH = 'a9e83866b383b05485636c150e66fb07a9b41853e9eb890b2ff1a34fa72746b5';

const sha256 = async (value) => {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false, error: '数据库未配置。' }, 503);
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token || !safeEqual(await sha256(token), TOKEN_HASH)) {
    return json({ ok: false, error: '未授权。' }, 401);
  }

  try {
    const tables = (await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all()).results || [];
    const counts = {};
    for (const { name } of tables) {
      if (!/^[a-zA-Z0-9_]+$/.test(name)) continue;
      counts[name] = Number((await env.DB.prepare(`SELECT COUNT(*) AS total FROM ${name}`).first())?.total || 0);
    }
    const users = (await env.DB.prepare(
      'SELECT id, username, email, display_name, role, learning_system, status, email_verified, created_at FROM users ORDER BY id'
    ).all()).results || [];
    return json({ ok: true, counts, users });
  } catch (error) {
    return json({ ok: false, error: error?.message || String(error) }, 500);
  }
}
