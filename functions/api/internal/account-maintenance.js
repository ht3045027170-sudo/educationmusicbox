import { hashPassword, json, readBody, safeEqual } from '../shared.js';

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
    const body = await readBody(request);
    const action = String(body.action || 'inspect');
    const accountTables = [
      'users', 'sessions', 'classes', 'class_students',
      'homework_assignments', 'homework_submissions', 'admin_audit_logs',
    ];
    const counts = {};
    for (const table of accountTables) {
      try {
        counts[table] = Number((await env.DB.prepare(`SELECT COUNT(*) AS total FROM ${table}`).first())?.total || 0);
      } catch {
        counts[table] = null;
      }
    }
    const users = (await env.DB.prepare(
      'SELECT id, username, email, display_name, role, learning_system, status, email_verified, created_at FROM users ORDER BY id'
    ).all()).results || [];
    if (action === 'inspect') return json({ ok: true, counts, users });

    if (action === 'backup') {
      const backup = {};
      for (const table of accountTables) {
        try { backup[table] = (await env.DB.prepare(`SELECT * FROM ${table}`).all()).results || []; }
        catch { backup[table] = []; }
      }
      return json({ ok: true, exportedAt: new Date().toISOString(), backup });
    }

    if (action !== 'reset' || body.confirm !== 'DELETE_ALL_USERS') {
      return json({ ok: false, error: '确认文字不正确。' }, 400);
    }
    const password = String(body.password || '');
    if (password.length < 6) return json({ ok: false, error: '临时密码至少 6 位。' }, 400);
    const { salt, hash } = await hashPassword(password);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM homework_submissions'),
      env.DB.prepare('DELETE FROM homework_assignments'),
      env.DB.prepare('DELETE FROM class_students'),
      env.DB.prepare('DELETE FROM classes'),
      env.DB.prepare('DELETE FROM admin_audit_logs'),
      env.DB.prepare('DELETE FROM sessions'),
      env.DB.prepare('UPDATE questions SET created_by = NULL'),
      env.DB.prepare('DELETE FROM users'),
      env.DB.prepare(
        "INSERT INTO users (username, email, password_hash, password_salt, display_name, role, learning_system, email_verified, status) VALUES (?, ?, ?, ?, ?, 'teacher', 'gaokao', 1, 'active')"
      ).bind('admin', 'admin@haitang.local', hash, salt, 'admin'),
    ]);
    return json({ ok: true, deletedUsers: users.length, teacher: { username: 'admin', role: 'teacher', learningSystem: 'gaokao' } });
  } catch (error) {
    return json({ ok: false, error: error?.message || String(error) }, 500);
  }
}
