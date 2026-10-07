import { validQuestionAnswer, gradeHomework, assignmentSections, assignmentQuestions } from '../../../../homework-grading.js';
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
      'SELECT a.id, a.due_at, a.question_ids, COALESCE(x.allow_retry,0) AS allow_retry, x.max_attempts, COALESCE(x.score_policy,\'highest\') AS score_policy, x.deleted_at, x.question_set_id FROM homework_assignments a ' +
      'JOIN classes c ON c.id = a.class_id ' +
      'JOIN class_students cs ON cs.class_id = c.id AND cs.student_id = ? ' +
      'LEFT JOIN assignment_settings x ON x.assignment_id = a.id ' +
      'WHERE a.id = ? AND c.system_code = ?'
    ).bind(user.id, assignmentId, String(params.system || '')).first();
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

    const { rows, versioned } = await assignmentQuestions(env, assignment, questionIds);
    const byId = new Map(rows.map((r) => {
      let content = {};
      try { content = JSON.parse(r.content || '{}'); } catch {}
      return [r.id, content];
    }));

    if (rows.some(row => !validQuestionAnswer(byId.get(row.id)||{},row.question_type))) return json({ok:false,error:'作业中有题目标准答案或选项无效，请联系老师修正。'},422);

    let grade;
    try { grade = gradeHomework(questionIds, byId, submittedAnswers, await assignmentSections(env, assignment)); }
    catch (error) { return json({ ok: false, error: error.message }, 422); }
    const { correct: correctCount, total, score, gradedAnswers, earned, possible } = grade;
    const wrongCount = total - correctCount;

    const answerJson = JSON.stringify(gradedAnswers), attemptNo = attemptCount + 1;
    try {
      await env.DB.batch([
        env.DB.prepare('INSERT INTO homework_attempts (assignment_id, student_id, attempt_no, answers, score, wrong_count) VALUES (?, ?, ?, ?, ?, ?)').bind(assignmentId,user.id,attemptNo,answerJson,score,wrongCount),
        env.DB.prepare('INSERT INTO homework_submissions (assignment_id, student_id, answers, score, wrong_count) SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM homework_submissions WHERE assignment_id=? AND student_id=?)').bind(assignmentId,user.id,answerJson,score,wrongCount,assignmentId,user.id),
        env.DB.prepare('UPDATE homework_submissions SET answers=?, score=?, wrong_count=?, submitted_at=CURRENT_TIMESTAMP WHERE assignment_id=? AND student_id=? AND score<=?').bind(answerJson,score,wrongCount,assignmentId,user.id,score),
      ]);
    } catch(error) {
      if (/UNIQUE constraint failed: homework_attempts/i.test(error.message||'')) return json({ok:false,error:'另一个页面已提交这次作答，请刷新后查看最新记录。'},409);
      throw error;
    }
    const latest=await env.DB.prepare('SELECT score FROM homework_submissions WHERE assignment_id=? AND student_id=?').bind(assignmentId,user.id).first();

    return json({ ok: true, score, bestScore: Number(latest?.score ?? score), correct: correctCount, total, earned, possible, attempt: attemptNo });
  } catch (error) {
    return json({ ok: false, error: '提交作业失败：' + (error.message || String(error)) }, 500);
  }
}
