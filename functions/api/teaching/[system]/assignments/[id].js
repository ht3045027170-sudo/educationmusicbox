import { json, verifyCsrfRequest, requireTeacher } from '../../../shared.js';

// DELETE /api/teaching/{system}/assignments/{id}
// 撤回并删除一份作业（连带删除全部提交记录，不可恢复）
export async function onRequestDelete({ request, env, params }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const auth = await requireTeacher(request, env);
    if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
    const csrf = await verifyCsrfRequest(request, env);
    if (!csrf.ok) return json({ ok: false, error: csrf.error }, csrf.status);

    const id = Number(params.id);
    const row = await env.DB.prepare('SELECT id, teacher_id FROM homework_assignments WHERE id = ?').bind(id).first();
    if (!row) return json({ ok: false, error: '作业不存在。' }, 404);
    if (auth.user.role !== 'admin' && row.teacher_id !== auth.user.id) {
      return json({ ok: false, error: '只能删除自己发布的作业。' }, 403);
    }

    await env.DB.batch([
      env.DB.prepare('DELETE FROM homework_submissions WHERE assignment_id = ?').bind(id),
      env.DB.prepare('DELETE FROM homework_assignments WHERE id = ?').bind(id),
    ]);

    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: '删除作业失败：' + (error.message || String(error)) }, 500);
  }
}
