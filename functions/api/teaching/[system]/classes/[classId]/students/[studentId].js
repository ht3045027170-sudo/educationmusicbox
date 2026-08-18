import { json, verifyCsrfRequest, requireTeacher } from '../../../../../shared.js';

// DELETE /api/teaching/{system}/classes/{classId}/students/{studentId}
// 把学生移出班级（不影响其账号与其他班级）
export async function onRequestDelete({ request, env, params }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const auth = await requireTeacher(request, env);
    if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
    const csrf = await verifyCsrfRequest(request, env);
    if (!csrf.ok) return json({ ok: false, error: csrf.error }, csrf.status);

    const classId = Number(params.classId), studentId = Number(params.studentId);
    const row = await env.DB.prepare('SELECT id, teacher_id FROM classes WHERE id = ?').bind(classId).first();
    if (!row) return json({ ok: false, error: '班级不存在。' }, 404);
    if (auth.user.role !== 'admin' && row.teacher_id !== auth.user.id) {
      return json({ ok: false, error: '只能管理自己创建的班级。' }, 403);
    }

    // 移出名单 + 清掉该生在本班各作业的提交记录
    const info = await env.DB.prepare(
      'DELETE FROM class_students WHERE class_id = ? AND student_id = ?'
    ).bind(classId, studentId).run();
    if (!info.meta?.changes) return json({ ok: false, error: '该学生不在此班级中。' }, 404);
    await env.DB.prepare(
      'DELETE FROM homework_submissions WHERE student_id = ? AND assignment_id IN (SELECT id FROM homework_assignments WHERE class_id = ?)'
    ).bind(studentId, classId).run();

    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: '移除学生失败：' + (error.message || String(error)) }, 500);
  }
}
