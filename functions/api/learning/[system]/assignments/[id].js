import { prepareQuestionMusic } from '../../../question-music.js';
import { validQuestionAnswer, answersEqual, assignmentSections, assignmentQuestions, studentContent } from '../../../homework-grading.js';
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
      'SELECT a.id, a.title, a.instructions, a.subject, a.due_at, a.question_ids, c.system_code, ' +
      'COALESCE(x.allow_retry,0) AS allow_retry, x.max_attempts, COALESCE(x.score_policy,\'highest\') AS score_policy, x.deleted_at, x.question_set_id ' +
      'FROM homework_assignments a JOIN classes c ON c.id = a.class_id ' +
      'JOIN class_students cs ON cs.class_id = c.id AND cs.student_id = ? ' +
      'LEFT JOIN assignment_settings x ON x.assignment_id = a.id ' +
      'WHERE a.id = ? AND c.system_code = ?'
    ).bind(user.id, assignmentId, String(params.system || '')).first();
    if (!assignment || assignment.deleted_at) return json({ ok: false, error: '作业不存在、已删除或你不在对应班级。' }, 404);

    const submission = await env.DB.prepare(
      'SELECT answers, score, submitted_at FROM homework_submissions WHERE assignment_id = ? AND student_id = ?'
    ).bind(assignmentId, user.id).first();
    const { results: attempts } = await env.DB.prepare(
      'SELECT attempt_no, score, wrong_count, submitted_at FROM homework_attempts WHERE assignment_id = ? AND student_id = ? ORDER BY attempt_no'
    ).bind(assignmentId, user.id).all();

    let questionIds = [];
    try { const arr = JSON.parse(assignment.question_ids || '[]'); questionIds = Array.isArray(arr) ? arr : []; } catch {}

    const { rows, versioned } = await assignmentQuestions(env, assignment, questionIds);
    const byId = new Map(rows.map((r) => {
      let content = {};
      try { content = JSON.parse(r.content || '{}'); } catch {}
      const music = prepareQuestionMusic(content, assignment.subject === 'dictation' || content.audioScript ? 'dictation' : 'theory');
      content = music.error ? {...content,musicError:music.error} : music.content;
      return [r.id, content];
    }));

    const answers = {};
    if (submission) {
      try { Object.assign(answers, JSON.parse(submission.answers || '{}')); } catch {}
    }

    const issue = [...byId.values()].find(content => content.musicError)?.musicError || (rows.some(row => !validQuestionAnswer(byId.get(row.id)||{},row.question_type)) ? '作业中有题目标准答案或选项无效，请联系老师修正。' : '');
    const mayRetry = Boolean(assignment.allow_retry) && (!assignment.max_attempts || attempts.length < Number(assignment.max_attempts));
    // 按作业里的题目顺序输出；首次作答时隐藏答案，提交后可查看错题并按规则重做。
    const questionTypes = new Map(rows.map(row => [Number(row.id), row.question_type]));
    const questions = questionIds.map((qid) => {
      const content = byId.get(qid) || {};
      const submitted = submission ? (answers[qid] ?? '') : undefined;
      if (!submission || (mayRetry && !review)) {
        return {
          question_id: qid, question_type: questionTypes.get(Number(qid)),
          content: studentContent(content),
          answer: undefined,
        };
      }

      return {
        question_id: qid, question_type: questionTypes.get(Number(qid)),
        content: studentContent(content, true),
        answer: submitted,
        correct: answersEqual(submitted, content.answer),
      };
    });

    const paperSections = await assignmentSections(env, assignment);
    const sections = paperSections.map((section, index) => ({
      id: section.id || `section-${index + 1}`, title: section.title || `第${index + 1}部分`,
      type: section.type || 'mixed', order: Number(section.order || index + 1),
      question_ids: [...(section.questions || [])].sort((a,b) => Number(a.order||0)-Number(b.order||0)).map(item => Number(item.questionId)),
    })).sort((a,b) => a.order-b.order);

    return json({
      assignment: {
        id: assignment.id, issue, subject:assignment.subject, versioned, title: assignment.title, instructions: assignment.instructions,
        due_at: assignment.due_at, score: submission ? submission.score : null,
        submitted_at: submission ? submission.submitted_at : null, allow_retry: Boolean(assignment.allow_retry),
        max_attempts: assignment.max_attempts, attempt_count: attempts.length, can_submit: !issue && (!submission || mayRetry) && (!assignment.due_at || Date.parse(assignment.due_at) >= Date.now()),
        score_policy: assignment.score_policy, question_set_id: assignment.question_set_id, sections,
      },
      questions, attempts,
    });
  } catch (error) {
    return json({ ok: false, error: '加载作业详情失败：' + (error.message || String(error)) }, 500);
  }
}
