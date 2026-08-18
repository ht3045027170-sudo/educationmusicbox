import { json, bytesToHex, readBody } from '../shared.js';

// POST /api/auth/reset-password
// body: { token, password }
export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const body = await readBody(request);
    const token = String(body.token || '');
    const password = String(body.password || '');
    if (!token || password.length < 10) {
      return json({ ok: false, error: '缺少 token 或新密码少于 10 位。' }, 400);
    }
    const row = await env.DB.prepare(
      "SELECT user_id FROM sessions WHERE token = ? AND csrf = 'pending'"
    ).bind('verify:' + token).first();
    if (!row) return json({ ok: false, error: '重置链接无效或已过期，请重新申请。' }, 400);

    // PBKDF2 哈希新密码
    const enc = new TextEncoder();
    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
      baseKey, 256,
    );
    const newHash = bytesToHex(new Uint8Array(bits));
    const newSalt = bytesToHex(saltBytes);
    await env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?')
      .bind(newHash, newSalt, row.user_id).run();
    await env.DB.prepare("DELETE FROM sessions WHERE token = ? AND csrf = 'pending'").bind('verify:' + token).run();
    return json({ ok: true, message: '密码已重置，请重新登录。' });
  } catch (error) {
    return json({ ok: false, error: '重置失败：' + (error.message || String(error)) }, 500);
  }
}
