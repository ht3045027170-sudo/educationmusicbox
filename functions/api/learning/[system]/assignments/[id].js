import { json, currentUser, ensureCollaborationSchema } from '../../../shared.js';

// GET /api/learning/{system}/assignments/{id}  作业详情（题目 + 本人提交情况）
export async function onRequestGet({ request, env, params }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const user = await currentUser(request, env);
    if (!user) return json({ ok: false, error: '请先登录后再查看作业。' }, 401);
    const assignmentId = Number(params.id);
    const review = new URL(request.url).searchParams.get('review') === '1';
    await ensureCollaborationSchema(env);

    // 必须是布置给该学生所在班级的作业
    const assignment = await env.DB.prepare(
      'SELECT a.id, a.title, a.instructions, a.due_at, a.question_ids, c.system_code, ' +
      'COALESCE(x.allow_retry,0) AS allow_retry, x.max_attempts, COALESCE(x.score_policy,\'highest\') AS score_policy, x.deleted_at, x.question_set_id ' +
      'FROM homework_assignments a JOIN classes c ON c.id = a.class_id ' +
      'JOIN class_students cs ON cs.class_id = c.id AND cs.student_id = ? ' +
      'LEFT JOIN assignment_settings x ON x.assignment_id = a.id ' +
      'WHERE a.id = ?'
    ).bind(user.id, assignmentId).first();
    if (!assignment || assignment.deleted_at) return json({ ok: false, error: '作业不存在、已删除或你不在对应班级。' }, 404);

    const submission = await env.DB.prepare(
      'SELECT answers, score, submitted_at FROM homework_submissions WHERE assignment_id = ? AND student_id = ?'
    ).bind(assignmentId, user.id).first();
    const { results: attempts } = await env.DB.prepare(
      'SELECT attempt_no, score, wrong_count, submitted_at FROM homework_attempts WHERE assignment_id = ? AND student_id = ? ORDER BY attempt_no'
    ).bind(assignmentId, user.id).all();

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

    const mayRetry = Boolean(assignment.allow_retry) && (!assignment.max_attempts || attempts.length < Number(assignment.max_attempts));
    // 按作业里的题目顺序输出；首次作答时隐藏答案，提交后可查看错题并按规则重做。
    const questions = questionIds.map((qid) => {
      const content = byId.get(qid) || {};
      const submitted = submission ? String(answers[qid] ?? '') : undefined;
      if (!submission || (mayRetry && !review)) {
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

    let sections = [];
    if (assignment.question_set_id) {
      const set = await env.DB.prepare('SELECT sections_json FROM question_sets WHERE id=?').bind(assignment.question_set_id).first();
      try {
        sections = JSON.parse(set?.sections_json || '[]').map((section, index) => ({
          id: section.id || `section-${index + 1}`,
          title: section.title || `第${index + 1}部分`,
          type: section.type || 'mixed',
          order: Number(section.order || index + 1),
          question_ids: (section.questions || []).sort((a,b)=>Number(a.order||0)-Number(b.order||0)).map(item => Number(item.questionId)).filter(Number.isInteger),
        })).sort((a,b)=>a.order-b.order);
      } catch { sections = []; }
    }

    return json({
      assignment: {
        id: assignment.id, title: assignment.title, instructions: assignment.instructions,
        due_at: assignment.due_at, score: submission ? submission.score : null,
        submitted_at: submission ? submission.submitted_at : null, allow_retry: Boolean(assignment.allow_retry),
        max_attempts: assignment.max_attempts, attempt_count: attempts.length, can_submit: !submission || mayRetry,
        score_policy: assignment.score_policy, question_set_id: assignment.question_set_id, sections,
      },
      questions, attempts,
    });
  } catch (error) {
    return json({ ok: false, error: '加载作业详情失败：' + (error.message || String(error)) }, 500);
  }
}

function standardText(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).join('|').toLowerCase();
  return String(value ?? '').trim().toLowerCase();
}
