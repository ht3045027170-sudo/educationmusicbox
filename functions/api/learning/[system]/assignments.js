import { json, currentUser, ensureCollaborationSchema } from '../../shared.js';

// GET /api/learning/{system}/assignments  学生在某子系统的作业列表
export async function onRequestGet({ request, env, params }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const user = await currentUser(request, env);
    if (!user) return json({ ok: false, error: '请先登录后再查看作业。' }, 401);
    const system = String(params.system || '');
    if (!['hobby', 'gaokao'].includes(system)) return json({ ok: false, error: '未知的子系统。' }, 404);
    await ensureCollaborationSchema(env);

    const { results } = await env.DB.prepare(
      'SELECT a.id, a.title, a.instructions, a.subject, a.class_id, c.name AS class_name, a.question_ids, a.due_at, a.created_at, s.score, s.submitted_at, ' +
      'COALESCE(x.allow_retry,0) AS allow_retry, x.max_attempts, COALESCE(x.score_policy,\'highest\') AS score_policy, x.question_set_id, ' +
      '(SELECT COUNT(*) FROM homework_attempts h WHERE h.assignment_id=a.id AND h.student_id=?) AS attempt_count ' +
      'FROM homework_assignments a ' +
      'JOIN classes c ON c.id = a.class_id ' +
      'LEFT JOIN class_students cs ON cs.class_id = c.id AND cs.student_id = ? ' +
      'LEFT JOIN homework_submissions s ON s.assignment_id = a.id AND s.student_id = ? ' +
      'LEFT JOIN assignment_settings x ON x.assignment_id = a.id ' +
      'WHERE c.system_code = ? AND x.deleted_at IS NULL AND (c.teacher_id = ? OR cs.student_id = ?) ORDER BY a.created_at DESC'
    ).bind(user.id, user.id, user.id, system, user.id, user.id).all();

    const items = results.map((row) => {
      let questionCount = 0;
      try { const arr = JSON.parse(row.question_ids || '[]'); questionCount = Array.isArray(arr) ? arr.length : 0; } catch {}
      return {
        id: row.id, title: row.title, instructions: row.instructions, subject: row.subject, class_id: row.class_id, class_name: row.class_name,
        question_count: questionCount, due_at: row.due_at, created_at: row.created_at,
        score: row.score, submitted_at: row.submitted_at, allow_retry: Boolean(row.allow_retry),
        max_attempts: row.max_attempts, attempt_count: Number(row.attempt_count || 0), score_policy: row.score_policy,
        question_set_id: row.question_set_id,
      };
    });
    return json({ items });
  } catch (error) {
    return json({ ok: false, error: '加载作业失败：' + (error.message || String(error)) }, 500);
  }
}
