import { json, requireTeacher } from '../../../../shared.js';

// GET /api/teaching/{system}/assignments/{id}/results  作业成绩（含未提交学生）
export async function onRequestGet({ request, env, params }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const auth = await requireTeacher(request, env);
    if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
    const assignmentId = Number(params.id);

    const assignment = await env.DB.prepare(
      'SELECT a.id, a.class_id FROM homework_assignments a ' +
      'JOIN classes c ON c.id = a.class_id WHERE a.id = ? AND c.teacher_id = ?'
    ).bind(assignmentId, auth.user.id).first();
    if (!assignment) return json({ ok: false, error: '作业不存在或无权访问。' }, 404);

    const { results } = await env.DB.prepare(
      'SELECT u.username, u.display_name, s.score, s.wrong_count, s.submitted_at, s.answers ' +
      'FROM class_students cs ' +
      'JOIN users u ON u.id = cs.student_id ' +
      'LEFT JOIN homework_submissions s ON s.assignment_id = ? AND s.student_id = cs.student_id ' +
      'WHERE cs.class_id = ? ORDER BY s.submitted_at IS NULL, s.submitted_at DESC'
    ).bind(assignmentId, assignment.class_id).all();

    const items = results.map((row) => ({
      username: row.display_name || row.username,
      score: row.score,
      wrong_count: row.wrong_count,
      submitted_at: row.submitted_at,
    }));
    return json({ items });
  } catch (error) {
    return json({ ok: false, error: '加载成绩失败：' + (error.message || String(error)) }, 500);
  }
}
