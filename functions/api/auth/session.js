import { json, parseCookies } from '../shared.js';

// GET /api/auth/session  -> { user }
// 仅返回当前登录用户。未登录返回 user: null。
export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ user: null });
  try {
    const cookies = parseCookies(request.headers.get('cookie'));
    const sid = cookies.mb_sid;
    if (!sid) return json({ user: null });
    const row = await env.DB.prepare(`
      SELECT s.expires_at AS expires_at,
             u.id, u.username, u.email, u.display_name, u.role, u.learning_system,
             u.status, u.email_verified, u.created_at, u.profiles_json
      FROM sessions s
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.token = ?`).bind(sid).first();
    if (!row) return json({ user: null });
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(sid).run();
      return json({ user: null });
    }
    let profiles = {};
    try { profiles = JSON.parse(row.profiles_json || '{}'); } catch {}
    return json({
      user: {
        id: row.id,
        username: row.username,
        email: row.email,
        displayName: row.display_name,
        role: row.role,
        learningSystem: row.learning_system,
        status: row.status,
        emailVerified: !!row.email_verified,
        createdAt: row.created_at,
        profiles,
      },
    });
  } catch {
    return json({ user: null });
  }
}
