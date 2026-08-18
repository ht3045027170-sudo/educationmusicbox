import { json, requireTeacher } from '../../../shared.js';

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
