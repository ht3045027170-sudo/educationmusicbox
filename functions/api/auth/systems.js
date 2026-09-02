import { json, parseCookies, effectiveRole } from '../shared.js';

// GET /api/auth/systems
// 返回用户关联的两个学习系统的档案（爱好 + 高考）
export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ systems: [] });
  try {
    const cookies = parseCookies(request.headers.get('cookie'));
    const sid = cookies.mb_sid;
    if (!sid) return json({ systems: [] });
    const row = await env.DB.prepare(`
      SELECT u.id, u.role, u.profiles_json, s.expires_at
      FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ?`).bind(sid).first();
    if (!row || new Date(row.expires_at).getTime() < Date.now()) {
      return json({ systems: [] });
    }
    row.role = effectiveRole(row);
    let profiles = {};
    try { profiles = JSON.parse(row.profiles_json || '{}'); } catch {}
    return json({
      systems: [
        {
          system_code: 'hobby',
          role: ['teacher', 'admin'].includes(row.role) ? row.role : 'learner',
          profile: profiles.hobby || { name: '', instrument: '吉他', age: 12, dailyMinutes: 30 },
        },
        {
          system_code: 'gaokao',
          role: ['teacher', 'admin'].includes(row.role) ? row.role : 'learner',
          profile: profiles.gaokao || { name: '', examDate: '', direction: '', primaryMajor: '', secondaryMajor: '', province: '广东省' },
        },
      ],
    });
  } catch {
    return json({ systems: [] });
  }
}
