import { json, readBody, verifyCsrfRequest, currentUser, ensureClassMessages } from '../../../../shared.js';

async function accessibleClass(env, system, classId, userId) {
  return env.DB.prepare(
    'SELECT DISTINCT c.id, c.name, c.teacher_id FROM classes c LEFT JOIN class_students cs ON cs.class_id = c.id ' +
    'WHERE c.id = ? AND c.system_code = ? AND (c.teacher_id = ? OR cs.student_id = ?)'
  ).bind(classId, system, userId, userId).first();
}

export async function onRequestGet({ request, env, params }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const user = await currentUser(request, env);
    if (!user) return json({ ok: false, error: '请先登录后再查看班级消息。' }, 401);
    const system = String(params.system || ''), classId = Number(params.classId);
    if (!['hobby', 'gaokao'].includes(system)) return json({ ok: false, error: '未知的子系统。' }, 404);
    const cls = await accessibleClass(env, system, classId, user.id);
    if (!cls) return json({ ok: false, error: '班级不存在或你尚未加入。' }, 404);
    await ensureClassMessages(env);
    const { results } = await env.DB.prepare(
      'SELECT m.id, m.sender_id, m.kind, m.content, m.assignment_id, m.created_at, u.username, u.display_name, u.role ' +
      'FROM class_messages m LEFT JOIN users u ON u.id = m.sender_id WHERE m.class_id = ? ORDER BY m.id DESC LIMIT 100'
    ).bind(classId).all();
    return json({ class: { id: cls.id, name: cls.name }, items: results.reverse().map(row => ({ ...row, is_mine: row.sender_id === user.id })) });
  } catch (error) {
    return json({ ok: false, error: '加载班级消息失败：' + (error.message || String(error)) }, 500);
  }
}

export async function onRequestPost({ request, env, params }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const user = await currentUser(request, env);
    if (!user) return json({ ok: false, error: '请先登录后再发送消息。' }, 401);
    const csrfCheck = await verifyCsrfRequest(request, env);
    if (!csrfCheck.ok) return json({ ok: false, error: csrfCheck.error }, csrfCheck.status);
    const system = String(params.system || ''), classId = Number(params.classId);
    if (!['hobby', 'gaokao'].includes(system)) return json({ ok: false, error: '未知的子系统。' }, 404);
    const cls = await accessibleClass(env, system, classId, user.id);
    if (!cls) return json({ ok: false, error: '班级不存在或你尚未加入。' }, 404);
    const body = await readBody(request), content = String(body.content || '').trim();
    if (!content || content.length > 1000) return json({ ok: false, error: '消息长度需在 1-1000 字之间。' }, 400);
    await ensureClassMessages(env);
    const result = await env.DB.prepare(
      "INSERT INTO class_messages (class_id, sender_id, kind, content) VALUES (?, ?, 'text', ?)"
    ).bind(classId, user.id, content).run();
    return json({ ok: true, id: result.meta.last_row_id });
  } catch (error) {
    return json({ ok: false, error: '发送消息失败：' + (error.message || String(error)) }, 500);
  }
}
