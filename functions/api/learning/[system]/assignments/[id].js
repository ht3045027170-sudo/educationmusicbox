import { json, currentUser } from '../../../shared.js';

// GET /api/learning/{system}/assignments/{id}  作业详情（题目 + 本人提交情况）
export async function onRequestGet({ request, env, params }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const user = await currentUser(request, env);
    if (!user) return json({ ok: false, error: '请先登录后再查看作业。' }, 401);
    const assignmentId = Number(params.id);

    // 必须是布置给该学生所在班级的作业
    const assignment = await env.DB.prepare(
      'SELECT a.id, a.title, a.instructions, a.due_at, a.question_ids, c.system_code ' +
      'FROM homework_assignments a JOIN classes c ON c.id = a.class_id ' +
      'JOIN class_students cs ON cs.class_id = c.id AND cs.student_id = ? ' +
      'WHERE a.id = ?'
    ).bind(user.id, assignmentId).first();
    if (!assignment) return json({ ok: false, error: '作业不存在或你不在对应班级。' }, 404);

    const submission = await env.DB.prepare(
      'SELECT answers, score, submitted_at FROM homework_submissions WHERE assignment_id = ? AND student_id = ?'
    ).bind(assignmentId, user.id).first();

    let questionIds = [];
    try { const arr = JSON.parse(assignment.question_ids || '[]'); questionIds = Array.isArray(arr) ? arr : []; } catch {}

    const placeholders = questionIds.map(() => '?').join(',') || 'NULL';
    const { results: rows } = await env.DB.prepare(
      `SELECT id, content FROM questions WHERE id IN (${placeholders})`
    ).bind(...questionIds).all();
    const byId = new Map(rows.map((r) => {
      let content = {};
      try { content = JSON.parse(r.content || '{}'); } catch {}
      return [r.id, content];
    }));

    const answers = {};
    if (submission) {
      try { Object.assign(answers, JSON.parse(submission.answers || '{}')); } catch {}
    }

    // 按作业里的题目顺序输出；未提交时隐藏答案与解析
    const questions = questionIds.map((qid) => {
      const content = byId.get(qid) || {};
      const submitted = submission ? String(answers[qid] ?? '') : undefined;
      if (!submission) {
        return {
          question_id: qid,
          content: { prompt: content.prompt || content.question || '', options: content.options || [] },
          answer: undefined,
        };
      }
      const correctText = standardText(content.answer);
      return {
        question_id: qid,
        content: { prompt: content.prompt || content.question || '', options: content.options || [], answer: content.answer, explanation: content.explanation || content.analysis || '' },
        answer: submitted,
        correct: standardText(submitted) === correctText,
      };
    });

    return json({
      assignment: {
        id: assignment.id, title: assignment.title, instructions: assignment.instructions,
        due_at: assignment.due_at, score: submission ? submission.score : null,
        submitted_at: submission ? submission.submitted_at : null,
      },
      questions,
    });
  } catch (error) {
    return json({ ok: false, error: '加载作业详情失败：' + (error.message || String(error)) }, 500);
  }
}

function standardText(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).join('|').toLowerCase();
  return String(value ?? '').trim().toLowerCase();
}
