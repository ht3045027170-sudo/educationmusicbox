import { json, verifyCsrfRequest, requireTeacher } from '../../../shared.js';

// DELETE /api/teaching/{system}/classes/{classId}
// 删除班级（连带清空学生名单、该班全部作业与提交记录，不可恢复）
export async function onRequestDelete({ request, env, params }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const auth = await requireTeacher(request, env);
    if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
    const csrf = await verifyCsrfRequest(request, env);
    if (!csrf.ok) return json({ ok: false, error: csrf.error }, csrf.status);

    const classId = Number(params.classId);
    const row = await env.DB.prepare('SELECT id, teacher_id FROM classes WHERE id = ?').bind(classId).first();
    if (!row) return json({ ok: false, error: '班级不存在。' }, 404);
    if (auth.user.role !== 'admin' && row.teacher_id !== auth.user.id) {
      return json({ ok: false, error: '只能删除自己创建的班级。' }, 403);
    }

    // 提交记录 → 作业 → 学生 → 班级
    await env.DB.batch([
      env.DB.prepare('DELETE FROM homework_submissions WHERE assignment_id IN (SELECT id FROM homework_assignments WHERE class_id = ?)').bind(classId),
      env.DB.prepare('DELETE FROM homework_assignments WHERE class_id = ?').bind(classId),
      env.DB.prepare('DELETE FROM class_students WHERE class_id = ?').bind(classId),
      env.DB.prepare('DELETE FROM classes WHERE id = ?').bind(classId),
    ]);

    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: '删除班级失败：' + (error.message || String(error)) }, 500);
  }
}
