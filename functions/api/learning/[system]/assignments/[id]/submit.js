import { json, readBody, verifyCsrfRequest, currentUser, ensureCollaborationSchema } from '../../../../shared.js';

// POST /api/learning/{system}/assignments/{id}/submit  提交整份作业并自动判分
export async function onRequestPost({ request, env, params }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const user = await currentUser(request, env);
    if (!user) return json({ ok: false, error: '请先登录后再提交作业。' }, 401);
    const csrfCheck = await verifyCsrfRequest(request, env);
    if (!csrfCheck.ok) return json({ ok: false, error: csrfCheck.error }, csrfCheck.status);
    const assignmentId = Number(params.id);
    await ensureCollaborationSchema(env);

    const assignment = await env.DB.prepare(
      'SELECT a.id, a.due_at, a.question_ids, COALESCE(x.allow_retry,0) AS allow_retry, x.max_attempts, COALESCE(x.score_policy,\'highest\') AS score_policy, x.deleted_at FROM homework_assignments a ' +
      'JOIN classes c ON c.id = a.class_id ' +
      'JOIN class_students cs ON cs.class_id = c.id AND cs.student_id = ? ' +
      'LEFT JOIN assignment_settings x ON x.assignment_id = a.id ' +
      'WHERE a.id = ?'
    ).bind(user.id, assignmentId).first();
    if (!assignment || assignment.deleted_at) return json({ ok: false, error: '作业不存在、已删除或你不在对应班级。' }, 404);

    const attempts = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM homework_attempts WHERE assignment_id = ? AND student_id = ?'
    ).bind(assignmentId, user.id).first();
    const attemptCount = Number(attempts?.count || 0);
    if (attemptCount && !assignment.allow_retry) return json({ ok: false, error: '这份作业不允许重做。' }, 409);
    if (assignment.max_attempts && attemptCount >= Number(assignment.max_attempts)) return json({ ok: false, error: '已达到最大作答次数。' }, 409);

    if (assignment.due_at && Date.parse(assignment.due_at) < Date.now()) {
      return json({ ok: false, error: '作业已过截止时间，无法提交。请联系老师。' }, 403);
    }

    const body = await readBody(request);
    const submittedAnswers = body.answers && typeof body.answers === 'object' ? body.answers : {};

    let questionIds = [];
    try { const arr = JSON.parse(assignment.question_ids || '[]'); questionIds = Array.isArray(arr) ? arr : []; } catch {}
    if (!questionIds.length) return json({ ok: false, error: '这份作业没有题目，请联系老师。' }, 400);

    const placeholders = questionIds.map(() => '?').join(',');
    const { results: rows } = await env.DB.prepare(
      `SELECT id, content FROM questions WHERE id IN (${placeholders})`
    ).bind(...questionIds).all();
    const byId = new Map(rows.map((r) => {
      let content = {};
      try { content = JSON.parse(r.content || '{}'); } catch {}
      return [r.id, content];
    }));

    let correctCount = 0;
    const gradedAnswers = {};
    for (const qid of questionIds) {
      const content = byId.get(qid) || {};
      const answer = submittedAnswers[qid] !== undefined ? String(submittedAnswers[qid]) : '';
      gradedAnswers[qid] = answer;
      const expected = Array.isArray(content.answer) ? content.answer.map((v) => String(v).trim()).join('|') : String(content.answer ?? '');
      const actual = Array.isArray(answer) ? answer.map((v) => String(v).trim()).join('|') : answer;
      if (actual.trim().toLowerCase() === expected.trim().toLowerCase()) correctCount++;
    }

    const total = questionIds.length;
    const score = total ? Math.round((correctCount / total) * 100) : 0;
    const wrongCount = total - correctCount;

    const answerJson = JSON.stringify(gradedAnswers), attemptNo = attemptCount + 1;
    await env.DB.prepare(
      'INSERT INTO homework_attempts (assignment_id, student_id, attempt_no, answers, score, wrong_count) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(assignmentId, user.id, attemptNo, answerJson, score, wrongCount).run();
    const previous = await env.DB.prepare('SELECT score FROM homework_submissions WHERE assignment_id=? AND student_id=?').bind(assignmentId, user.id).first();
    if (!previous) {
      await env.DB.prepare(
        'INSERT INTO homework_submissions (assignment_id, student_id, answers, score, wrong_count) VALUES (?, ?, ?, ?, ?)'
      ).bind(assignmentId, user.id, answerJson, score, wrongCount).run();
    } else if (score >= Number(previous.score || 0)) {
      await env.DB.prepare(
        'UPDATE homework_submissions SET answers=?, score=?, wrong_count=?, submitted_at=CURRENT_TIMESTAMP WHERE assignment_id=? AND student_id=?'
      ).bind(answerJson, score, wrongCount, assignmentId, user.id).run();
    }

    return json({ ok: true, score, bestScore: Math.max(score, Number(previous?.score || 0)), correct: correctCount, total, attempt: attemptNo });
  } catch (error) {
    return json({ ok: false, error: '提交作业失败：' + (error.message || String(error)) }, 500);
  }
}
