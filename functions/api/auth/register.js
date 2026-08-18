import { json, parseCookies, hashPassword, randomToken, readBody } from '../../_shared.js';

// POST /api/auth/register
// 接收 username, email, password, displayName, role（默认 learner）
// 成功后返回 devLink（开发环境邮件链接），方便点击完成邮箱验证
const TOKEN_TTL_HOURS = 24;

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const body = await readBody(request);
    const username = String(body.username || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const displayName = String(body.displayName || username || '').trim();
    const role = ['learner', 'teacher', 'admin'].includes(String(body.role || 'learner')) ? String(body.role) : 'learner';
    const learningSystem = String(body.learningSystem || body.system || 'hobby');

    if (!username || username.length < 2 || username.length > 40) {
      return json({ ok: false, error: '用户名长度需在 2-40 字符之间。' }, 400);
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ ok: false, error: '邮箱格式不正确。' }, 400);
    }
    if (password.length < 10) {
      return json({ ok: false, error: '密码至少 10 位，请用大小写字母加数字组合。' }, 400);
    }

    const exists = await env.DB.prepare('SELECT id FROM users WHERE username = ? OR email = ?').bind(username, email).first();
    if (exists) return json({ ok: false, error: '该用户名或邮箱已被注册。' }, 409);

    const { salt, hash } = await hashPassword(password);
    const result = await env.DB.prepare(
      'INSERT INTO users (username, email, password_hash, password_salt, display_name, role, learning_system) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(username, email, hash, salt, displayName, role, learningSystem).run();
    const userId = result.meta.last_row_id;

    // 临时存储验证 token 在 sessions 表上（避免再建一张表）；也可改用 KV
    const verifyToken = randomToken(24);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 3600 * 1000).toISOString();
    await env.DB.prepare(
      'INSERT INTO sessions (token, user_id, csrf, expires_at) VALUES (?, ?, ?, ?)'
    ).bind('verify:' + verifyToken, userId, 'pending', expiresAt).run();

    // 简易 devLink（内测阶段不接邮件服务时使用，链接里直接带 token）
    const origin = new URL(request.url).origin;
    const devLink = `${origin}/?accountAction=verify&token=${verifyToken}`;
    return json({ ok: true, userId, devLink });
  } catch (error) {
    return json({ ok: false, error: '注册失败：' + (error.message || String(error)) }, 500);
  }
}
