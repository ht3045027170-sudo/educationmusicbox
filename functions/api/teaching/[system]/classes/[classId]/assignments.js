import { json, readBody, verifyCsrfRequest, requireTeacher } from '../../../../shared.js';

// GET  /api/teaching/{system}/classes/{classId}/assignments  班级作业列表
// POST /api/teaching/{system}/classes/{classId}/assignments  发布作业
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
      'SELECT a.id, a.title, a.question_ids, a.due_at, a.created_at, ' +
      '(SELECT COUNT(*) FROM homework_submissions s WHERE s.assignment_id = a.id) AS submission_count, ' +
      'ROUND((SELECT AVG(s2.score) FROM homework_submissions s2 WHERE s2.assignment_id = a.id), 1) AS average_score ' +
      'FROM homework_assignments a WHERE a.class_id = ? ORDER BY a.created_at DESC'
    ).bind(classId).all();

    const items = results.map((row) => ({
      id: row.id,
      title: row.title,
      due_at: row.due_at,
      created_at: row.created_at,
      question_count: safeCount(row.question_ids),
      submission_count: row.submission_count,
      average_score: row.average_score,
    }));
    return json({ items });
  } catch (error) {
    return json({ ok: false, error: '加载作业失败：' + (error.message || String(error)) }, 500);
  }
}

export async function onRequestPost({ request, env, params }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const auth = await requireTeacher(request, env);
    if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
    const csrfCheck = await verifyCsrfRequest(request, env);
    if (!csrfCheck.ok) return json({ ok: false, error: csrfCheck.error }, csrfCheck.status);

    const classId = Number(params.classId);
    const system = String(params.system || '');
    const cls = await env.DB.prepare(
      'SELECT id, system_code FROM classes WHERE id = ? AND teacher_id = ?'
    ).bind(classId, auth.user.id).first();
    if (!cls) return json({ ok: false, error: '班级不存在或无权访问。' }, 404);

    const body = await readBody(request);
    const title = String(body.title || '').trim();
    const instructions = String(body.instructions || '').trim().slice(0, 1000);
    const subject = ['theory', 'dictation', 'sight_singing'].includes(body.subject) ? body.subject : 'theory';
    const dueAt = body.dueAt ? new Date(body.dueAt).toISOString() : null;
    const questionIds = Array.isArray(body.questionIds) ? body.questionIds.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];

    if (!title || title.length > 100) return json({ ok: false, error: '作业标题需在 1-100 字符之间。' }, 400);
    if (!questionIds.length) return json({ ok: false, error: '请至少选择一道题目。' }, 400);
    if (Number.isNaN(Date.parse(dueAt))) return json({ ok: false, error: '截止时间格式不正确。' }, 400);

    // 校验题目确实存在、已发布、且属于当前子系统
    const placeholders = questionIds.map(() => '?').join(',');
    const { results: valid } = await env.DB.prepare(
      `SELECT id FROM questions WHERE id IN (${placeholders}) AND system_code = ? AND status = 'published'`
    ).bind(...questionIds, cls.system_code).all();
    if (valid.length !== questionIds.length) {
      return json({ ok: false, error: '部分题目不存在、未发布或不属于该子系统。' }, 400);
    }

    const result = await env.DB.prepare(
      'INSERT INTO homework_assignments (class_id, teacher_id, title, instructions, subject, question_ids, due_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(classId, auth.user.id, title, instructions, subject, JSON.stringify(questionIds), dueAt).run();

    return json({ ok: true, id: result.meta.last_row_id });
  } catch (error) {
    return json({ ok: false, error: '发布作业失败：' + (error.message || String(error)) }, 500);
  }
}

function safeCount(jsonText) {
  try { const arr = JSON.parse(jsonText || '[]'); return Array.isArray(arr) ? arr.length : 0; } catch { return 0; }
}
