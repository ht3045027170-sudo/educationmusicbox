import { json, readBody, verifyCsrfRequest, requireTeacher, randomToken } from '../../shared.js';

// GET  /api/teaching/{system}/classes  教师的班级列表
// POST /api/teaching/{system}/classes  创建班级
const SYSTEMS = ['hobby', 'gaokao'];

export async function onRequestGet({ request, env, params }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const auth = await requireTeacher(request, env);
    if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
    const system = String(params.system || '');
    if (!SYSTEMS.includes(system)) return json({ ok: false, error: '未知的子系统。' }, 404);
    const { results } = await env.DB.prepare(
      'SELECT c.id, c.name, c.invite_code, ' +
      '(SELECT COUNT(*) FROM class_students cs WHERE cs.class_id = c.id) AS student_count, ' +
      '(SELECT COUNT(*) FROM homework_assignments ha WHERE ha.class_id = c.id) AS assignment_count ' +
      'FROM classes c WHERE c.teacher_id = ? AND c.system_code = ? ORDER BY c.created_at DESC'
    ).bind(auth.user.id, system).all();
    return json({ items: results });
  } catch (error) {
    return json({ ok: false, error: '加载班级失败：' + (error.message || String(error)) }, 500);
  }
}

export async function onRequestPost({ request, env, params }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const auth = await requireTeacher(request, env);
    if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
    const csrfCheck = await verifyCsrfRequest(request, env);
    if (!csrfCheck.ok) return json({ ok: false, error: csrfCheck.error }, csrfCheck.status);
    const system = String(params.system || '');
    if (!SYSTEMS.includes(system)) return json({ ok: false, error: '未知的子系统。' }, 404);

    const body = await readBody(request);
    const name = String(body.name || '').trim();
    if (!name || name.length > 80) return json({ ok: false, error: '班级名称需在 1-80 字符之间。' }, 400);

    // 生成 6 位邀请码，撞码重试
    let inviteCode = '';
    for (let i = 0; i < 5; i++) {
      const code = randomToken(3).toUpperCase();
      const exists = await env.DB.prepare('SELECT id FROM classes WHERE invite_code = ?').bind(code).first();
      if (!exists) { inviteCode = code; break; }
    }
    if (!inviteCode) return json({ ok: false, error: '邀请码生成失败，请重试。' }, 500);

    const result = await env.DB.prepare(
      'INSERT INTO classes (system_code, name, teacher_id, invite_code) VALUES (?, ?, ?, ?)'
    ).bind(system, name, auth.user.id, inviteCode).run();

    return json({ ok: true, id: result.meta.last_row_id, inviteCode });
  } catch (error) {
    return json({ ok: false, error: '创建班级失败：' + (error.message || String(error)) }, 500);
  }
}
