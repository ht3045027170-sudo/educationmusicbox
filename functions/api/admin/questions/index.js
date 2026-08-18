import { json, readBody, verifyCsrfRequest, currentUser } from '../../shared.js';

// ============ 题库管理：列表 + 创建草稿 ============
// GET  /api/admin/questions?page&pageSize&systemCode&subject&status&search
// POST /api/admin/questions   body: {systemCode,subject,instrument,difficulty,knowledgeId,questionType,sourceLabel,content}
// 角色：teacher 可出题（草稿/送审），admin 全权限。支持教师远程登录后出题。
const STATUSES = ['draft', 'submitted', 'in_review', 'changes_requested', 'approved', 'published', 'archived'];

const shapeQuestion = (row) => ({
  id: row.id,
  system_code: row.system_code,
  subject: row.subject,
  instrument: row.instrument || '',
  knowledge_id: row.knowledge_id || '',
  question_type: row.question_type || 'single_choice',
  difficulty: row.difficulty || 1,
  source_label: row.source_label || '',
  source_id: row.source_label || ('#' + row.id),
  status: row.status,
  version_no: row.version_no || 1,
  review_notes: row.review_notes || '',
  created_by: row.created_by,
  updated_at: row.updated_at,
  content: (() => { try { return JSON.parse(row.content || '{}'); } catch { return {}; } })(),
});

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const user = await currentUser(request, env);
    if (!user || !['teacher', 'admin'].includes(user.role)) {
      return json({ ok: false, error: '仅教师或管理员可访问题库。' }, 403);
    }
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 25));
    const systemCode = url.searchParams.get('systemCode') || '';
    const subject = url.searchParams.get('subject') || '';
    const status = url.searchParams.get('status') || '';
    const search = (url.searchParams.get('search') || '').trim();

    const where = [], binds = [];
    if (['hobby', 'gaokao'].includes(systemCode)) { where.push('system_code = ?'); binds.push(systemCode); }
    if (subject) { where.push('subject = ?'); binds.push(subject); }
    if (STATUSES.includes(status)) { where.push('status = ?'); binds.push(status); }
    if (search) {
      where.push('(content LIKE ? OR knowledge_id LIKE ? OR source_label LIKE ?)');
      const like = `%${search}%`;
      binds.push(like, like, like);
    }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const countRow = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM questions ${whereSql}`
    ).bind(...binds).first();
    const total = countRow?.total || 0;
    const pages = Math.max(1, Math.ceil(total / pageSize));

    const { results } = await env.DB.prepare(
      `SELECT * FROM questions ${whereSql} ORDER BY updated_at DESC, id DESC LIMIT ? OFFSET ?`
    ).bind(...binds, pageSize, (page - 1) * pageSize).all();

    return json({
      items: results.map(shapeQuestion),
      pagination: { page, pages, total },
    });
  } catch (error) {
    return json({ ok: false, error: '加载题库失败：' + (error.message || String(error)) }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const user = await currentUser(request, env);
    if (!user || !['teacher', 'admin'].includes(user.role)) {
      return json({ ok: false, error: '仅教师或管理员可出题。' }, 403);
    }
    const csrf = await verifyCsrfRequest(request, env);
    if (!csrf.ok) return json({ ok: false, error: csrf.error }, csrf.status);

    const body = await readBody(request);
    const systemCode = ['hobby', 'gaokao'].includes(String(body.systemCode || '')) ? String(body.systemCode) : '';
    if (!systemCode) return json({ ok: false, error: '请选择题目所属系统（音乐爱好者 / 高考音乐生）。' }, 400);
    const subject = ['theory', 'dictation', 'sight_singing'].includes(String(body.subject || '')) ? String(body.subject) : 'theory';
    const questionType = ['single_choice', 'multi_choice', 'true_false', 'text_input'].includes(String(body.questionType || ''))
      ? String(body.questionType) : 'single_choice';
    const knowledgeId = String(body.knowledgeId || '').trim();
    if (!knowledgeId) return json({ ok: false, error: '请填写知识点 ID（格式如 theory-interval-01）。' }, 400);
    const content = body.content && typeof body.content === 'object' ? body.content : {};
    if (!String(content.prompt || '').trim()) return json({ ok: false, error: '题干不能为空。' }, 400);
    if (String(content.answer ?? '').trim() === '') return json({ ok: false, error: '标准答案不能为空。' }, 400);
    const difficulty = Math.min(5, Math.max(1, Number(body.difficulty) || 1));

    const info = await env.DB.prepare(
      'INSERT INTO questions (system_code, subject, instrument, knowledge_id, question_type, difficulty, source_label, content, status, version_no, created_by) ' +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1, ?)"
    ).bind(
      systemCode, subject, String(body.instrument || '').trim(), knowledgeId, questionType, difficulty,
      String(body.sourceLabel || '').trim(), JSON.stringify(content), user.id
    ).run();

    return json({ ok: true, id: info.meta?.last_row_id });
  } catch (error) {
    return json({ ok: false, error: '创建题目失败：' + (error.message || String(error)) }, 500);
  }
}
