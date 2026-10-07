import { prepareQuestionMusic } from '../../../question-music.js';
import { validQuestionAnswer, canonicalQuestionContent } from '../../../homework-grading.js';
import { json, readBody, verifyCsrfRequest, currentUser, clientIp } from '../../../shared.js';

// ============ 审核流 ============
// POST /api/admin/questions/{id}/review  body: {action, notes}
// action: submit(送审) | approve(通过) | request_changes(退回) | publish(发布) | archive(归档)
// 规则：
//   - admin：可执行全部动作
//   - teacher：只能对自己的题目 submit / publish（内测期教师可自行发布，正式版可收紧为仅 admin 发布）
const ACTION_STATUS = {
  submit: 'submitted',
  approve: 'approved',
  request_changes: 'changes_requested',
  publish: 'published',
  archive: 'archived',
};

const logAudit = async (env, userId, action, target, ip) => {
  try {
    await env.DB.prepare(
      'INSERT INTO admin_audit_logs (admin_user_id, action, target, ip_address) VALUES (?, ?, ?, ?)'
    ).bind(userId, action, target, ip).run();
  } catch { /* 审计表结构不符时静默跳过，不影响主流程 */ }
};

export async function onRequestPost({ request, env, params }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const user = await currentUser(request, env);
    if (!user || !['teacher', 'admin'].includes(user.role)) {
      return json({ ok: false, error: '仅教师或管理员可操作题库。' }, 403);
    }
    const csrf = await verifyCsrfRequest(request, env);
    if (!csrf.ok) return json({ ok: false, error: csrf.error }, csrf.status);

    const body = await readBody(request);
    const action = String(body.action || '');
    const nextStatus = ACTION_STATUS[action];
    if (!nextStatus) return json({ ok: false, error: '未知的审核动作。' }, 400);

    const row = await env.DB.prepare('SELECT id, created_by, knowledge_id, version_no, content, subject, question_type FROM questions WHERE id = ?').bind(Number(params.id)).first();
    if (!row) return json({ ok: false, error: '题目不存在。' }, 404);

    const isOwner = row.created_by === user.id;
    if (user.role === 'teacher' && (!isOwner || !['submit', 'publish'].includes(action))) {
      return json({ ok: false, error: '教师仅能送审或发布自己的题目；审核、退回、归档需管理员。' }, 403);
    }

    let contentJson=row.content;
    if (['approve','publish'].includes(action)) {
      let content;
      try { content=canonicalQuestionContent(JSON.parse(row.content),row.question_type); } catch (_) { return json({ok:false,error:'题目内容损坏，请修正后审核。'},400); }
      if (!validQuestionAnswer(content,row.question_type)) return json({ok:false,error:'标准答案或选项无效；选择题答案必须在不重复的选项中，文字占位说明不能作为答案。'},400);
      const music=prepareQuestionMusic(content,row.subject);
      if (music.error) return json({ok:false,error:music.error},400);
      content=music.content;delete content.reviewReason;contentJson=JSON.stringify(content);
    }

    await env.DB.prepare(
      'UPDATE questions SET content = ?, status = ?, review_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(contentJson, nextStatus, String(body.notes || '').trim(), Number(params.id)).run();

    await logAudit(env, user.id, `question:${action}`, `题#${row.id} ${row.knowledge_id} v${row.version_no}`, clientIp(request));

    return json({ ok: true, status: nextStatus });
  } catch (error) {
    return json({ ok: false, error: '审核操作失败：' + (error.message || String(error)) }, 500);
  }
}
