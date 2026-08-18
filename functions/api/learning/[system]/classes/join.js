import { json, readBody, verifyCsrfRequest, currentUser } from '../../../shared.js';

// POST /api/learning/{system}/classes/join  学生凭邀请码加入班级
export async function onRequestPost({ request, env, params }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const user = await currentUser(request, env);
    if (!user) return json({ ok: false, error: '请先登录后再加入班级。' }, 401);
    const csrfCheck = await verifyCsrfRequest(request, env);
    if (!csrfCheck.ok) return json({ ok: false, error: csrfCheck.error }, csrfCheck.status);
    const system = String(params.system || '');
    if (!['hobby', 'gaokao'].includes(system)) return json({ ok: false, error: '未知的子系统。' }, 404);

    const body = await readBody(request);
    const inviteCode = String(body.inviteCode || '').trim().toUpperCase();
    if (!inviteCode || inviteCode.length > 20) return json({ ok: false, error: '请输入有效的班级邀请码。' }, 400);

    const cls = await env.DB.prepare(
      'SELECT id, name, system_code FROM classes WHERE invite_code = ?'
    ).bind(inviteCode).first();
    if (!cls || cls.system_code !== system) {
      return json({ ok: false, error: '邀请码无效，请向老师确认。' }, 404);
    }

    const exists = await env.DB.prepare(
      'SELECT id FROM class_students WHERE class_id = ? AND student_id = ?'
    ).bind(cls.id, user.id).first();
    if (exists) return json({ ok: true, message: '你已在该班级中。' });

    await env.DB.prepare(
      'INSERT INTO class_students (class_id, student_id) VALUES (?, ?)'
    ).bind(cls.id, user.id).run();
    return json({ ok: true, className: cls.name });
  } catch (error) {
    return json({ ok: false, error: '加入班级失败：' + (error.message || String(error)) }, 500);
  }
}
