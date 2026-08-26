import { json, readBody, verifyCsrfRequest, currentUser } from '../../shared.js';

// ============ 单题：详情 + 保存新版本 ============
// GET /api/admin/questions/{id}   → {question}
// PUT /api/admin/questions/{id}  → 保存为下一版本并送审 → {version}
export async function onRequestGet({ request, env, params }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const user = await currentUser(request, env);
    if (!user || !['teacher', 'admin'].includes(user.role)) {
      return json({ ok: false, error: '仅教师或管理员可访问题库。' }, 403);
    }
    const row = await env.DB.prepare('SELECT * FROM questions WHERE id = ?').bind(Number(params.id)).first();
    if (!row) return json({ ok: false, error: '题目不存在。' }, 404);
    let content = {};
    try { content = JSON.parse(row.content || '{}'); } catch {}
    return json({
      question: {
        id: row.id, system_code: row.system_code, subject: row.subject,
        instrument: row.instrument || '', knowledge_id: row.knowledge_id || '',
        question_type: row.question_type || 'single_choice', difficulty: row.difficulty || 1,
        source_label: row.source_label || '', source_id: row.source_label || ('#' + row.id),
        status: row.status, version_no: row.version_no || 1, review_notes: row.review_notes || '',
        created_by: row.created_by, updated_at: row.updated_at, content,
      },
    });
  } catch (error) {
    return json({ ok: false, error: '加载题目失败：' + (error.message || String(error)) }, 500);
  }
}

export async function onRequestPut({ request, env, params }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const user = await currentUser(request, env);
    if (!user || !['teacher', 'admin'].includes(user.role)) {
      return json({ ok: false, error: '仅教师或管理员可编辑题目。' }, 403);
    }
    const csrf = await verifyCsrfRequest(request, env);
    if (!csrf.ok) return json({ ok: false, error: csrf.error }, csrf.status);

    const row = await env.DB.prepare('SELECT id, created_by, version_no FROM questions WHERE id = ?').bind(Number(params.id)).first();
    if (!row) return json({ ok: false, error: '题目不存在。' }, 404);
    if (user.role === 'teacher' && row.created_by !== user.id) {
      return json({ ok: false, error: '只能编辑自己创建的题目。' }, 403);
    }

    const body = await readBody(request);
    const content = body.content && typeof body.content === 'object' ? body.content : {};
    if (!String(content.prompt || '').trim()) return json({ ok: false, error: '题干不能为空。' }, 400);
    if (String(content.answer ?? '').trim() === '') return json({ ok: false, error: '标准答案不能为空。' }, 400);
    const subject = ['theory', 'dictation', 'sight_singing'].includes(String(body.subject || '')) ? String(body.subject) : 'theory';
    const questionType = ['single_choice', 'multi_choice', 'true_false', 'text_input'].includes(String(body.questionType || ''))
      ? String(body.questionType) : 'single_choice';
    const difficulty = Math.min(5, Math.max(1, Number(body.difficulty) || 1));
    const nextVersion = (row.version_no || 1) + 1;

    const nextStatus = body.saveMode === 'draft' ? 'draft' : 'submitted';
    await env.DB.prepare(
      'UPDATE questions SET subject = ?, instrument = ?, knowledge_id = ?, question_type = ?, difficulty = ?, ' +
      'source_label = ?, content = ?, status = ?, version_no = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(
      subject, String(body.instrument || '').trim(), String(body.knowledgeId || '').trim(),
      questionType, difficulty, String(body.sourceLabel || '').trim(),
      JSON.stringify(content), nextStatus, nextVersion, Number(params.id)
    ).run();

    return json({ ok: true, version: nextVersion });
  } catch (error) {
    return json({ ok: false, error: '保存题目失败：' + (error.message || String(error)) }, 500);
  }
}
