import { json, readBody, verifyCsrfRequest, requireTeacher, ensureClassMessages } from '../../../../shared.js';

// GET /api/teaching/{system}/classes/{classId}/students
export async function onRequestGet({ request, env, params }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const auth = await requireTeacher(request, env);
    if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
    const classId = Number(params.classId);
    const cls = await env.DB.prepare(
      'SELECT id FROM classes WHERE id = ? AND teacher_id = ?'
    ).bind(classId, auth.user.id).first();
    if (!cls) return json({ ok: false, error: '班级不存在或无权访问。' }, 404);

    const url = new URL(request.url), search = String(url.searchParams.get('search') || '').trim();
    if (search) {
      const { results } = await env.DB.prepare(
        "SELECT u.id AS user_id, u.username, u.display_name, u.email FROM users u WHERE u.role = 'learner' AND u.status = 'active' AND (u.username LIKE ? OR u.display_name LIKE ? OR u.email LIKE ?) AND u.id NOT IN (SELECT student_id FROM class_students WHERE class_id = ?) LIMIT 20"
      ).bind(`%${search}%`, `%${search}%`, `%${search}%`, classId).all();
      return json({ items: results, search: true });
    }
    const { results } = await env.DB.prepare(
      'SELECT u.id AS user_id, u.username, u.display_name, cs.joined_at ' +
      'FROM class_students cs JOIN users u ON u.id = cs.student_id ' +
      'WHERE cs.class_id = ? ORDER BY cs.joined_at ASC'
    ).bind(classId).all();
    return json({ items: results });
  } catch (error) {
    return json({ ok: false, error: '加载学生失败：' + (error.message || String(error)) }, 500);
  }
}

export async function onRequestPost({ request, env, params }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const auth = await requireTeacher(request, env);
    if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
    const csrfCheck = await verifyCsrfRequest(request, env);
    if (!csrfCheck.ok) return json({ ok: false, error: csrfCheck.error }, csrfCheck.status);
    const classId = Number(params.classId), body = await readBody(request), studentId = Number(body.studentId);
    const cls = await env.DB.prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ?').bind(classId, auth.user.id).first();
    if (!cls) return json({ ok: false, error: '班级不存在或无权访问。' }, 404);
    const student = await env.DB.prepare("SELECT id, username, display_name FROM users WHERE id = ? AND role = 'learner' AND status = 'active'").bind(studentId).first();
    if (!student) return json({ ok: false, error: '没有找到可加入的学生账号。' }, 404);
    await env.DB.prepare('INSERT OR IGNORE INTO class_students (class_id, student_id) VALUES (?, ?)').bind(classId, studentId).run();
    await ensureClassMessages(env);
    await env.DB.prepare("INSERT INTO class_messages (class_id, sender_id, kind, content) VALUES (?, NULL, 'system', ?)").bind(classId, `${auth.user.display_name || auth.user.username}老师邀请${student.display_name || student.username}加入班级`).run();
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: '添加学生失败：' + (error.message || String(error)) }, 500);
  }
}
