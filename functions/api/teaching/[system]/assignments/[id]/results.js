import { json, requireTeacher } from '../../../../shared.js';

// GET /api/teaching/{system}/assignments/{id}/results
// 作业成绩（含未提交学生）+ 逐题明细（每题学生作答 vs 标准答案、对错）
export async function onRequestGet({ request, env, params }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const auth = await requireTeacher(request, env);
    if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
    const assignmentId = Number(params.id);

    const assignment = await env.DB.prepare(
      'SELECT a.id, a.class_id, a.question_ids FROM homework_assignments a ' +
      'JOIN classes c ON c.id = a.class_id WHERE a.id = ? AND c.teacher_id = ?'
    ).bind(assignmentId, auth.user.id).first();
    if (!assignment) return json({ ok: false, error: '作业不存在或无权访问。' }, 404);

    // 题目元信息（教师端可见标准答案）
    let questionIds = [];
    try { const arr = JSON.parse(assignment.question_ids || '[]'); questionIds = Array.isArray(arr) ? arr : []; } catch {}
    const questions = [];
    if (questionIds.length) {
      const placeholders = questionIds.map(() => '?').join(',');
      const { results: qRows } = await env.DB.prepare(
        `SELECT id, content FROM questions WHERE id IN (${placeholders})`
      ).bind(...questionIds).all();
      const byId = new Map(qRows.map((r) => {
        let c = {}; try { c = JSON.parse(r.content || '{}'); } catch {}
        return [r.id, c];
      }));
      for (const qid of questionIds) {
        const c = byId.get(qid) || {};
        questions.push({
          question_id: qid,
          prompt: c.prompt || c.question || `题目 #${qid}`,
          options: Array.isArray(c.options) ? c.options : [],
          answer: Array.isArray(c.answer) ? c.answer.join('|') : String(c.answer ?? ''),
        });
      }
    }

    const { results } = await env.DB.prepare(
      'SELECT u.username, u.display_name, s.score, s.wrong_count, s.submitted_at, s.answers ' +
      'FROM class_students cs ' +
      'JOIN users u ON u.id = cs.student_id ' +
      'LEFT JOIN homework_submissions s ON s.assignment_id = ? AND s.student_id = cs.student_id ' +
      'WHERE cs.class_id = ? ORDER BY s.submitted_at IS NULL, s.submitted_at DESC'
    ).bind(assignmentId, assignment.class_id).all();

    const items = results.map((row) => {
      let answers = {};
      try { answers = JSON.parse(row.answers || '{}'); } catch {}
      const detail = questions.map((q) => {
        const given = answers[q.question_id] !== undefined ? String(answers[q.question_id]) : '';
        const ok = given.trim().toLowerCase() === String(q.answer).trim().toLowerCase();
        return { question_id: q.question_id, given, ok };
      });
      return {
        username: row.display_name || row.username,
        score: row.score,
        wrong_count: row.wrong_count,
        submitted_at: row.submitted_at,
        detail: row.submitted_at ? detail : null,
      };
    });
    return json({ items, questions });
  } catch (error) {
    return json({ ok: false, error: '加载成绩失败：' + (error.message || String(error)) }, 500);
  }
}
