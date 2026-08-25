import { json, currentUser } from '../../shared.js';

// GET /api/learning/{system}/classes  当前账号可进入的班级
export async function onRequestGet({ request, env, params }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const user = await currentUser(request, env);
    if (!user) return json({ ok: false, error: '请先登录后再查看班级。' }, 401);
    const system = String(params.system || '');
    if (!['hobby', 'gaokao'].includes(system)) return json({ ok: false, error: '未知的子系统。' }, 404);
    const { results } = await env.DB.prepare(
      'SELECT DISTINCT c.id, c.name, c.teacher_id, u.display_name AS teacher_name, u.username AS teacher_username ' +
      'FROM classes c JOIN users u ON u.id = c.teacher_id ' +
      'LEFT JOIN class_students cs ON cs.class_id = c.id ' +
      'WHERE c.system_code = ? AND (c.teacher_id = ? OR cs.student_id = ?) ORDER BY c.created_at DESC'
    ).bind(system, user.id, user.id).all();
    return json({ items: results.map(row => ({ ...row, is_teacher: row.teacher_id === user.id })) });
  } catch (error) {
    return json({ ok: false, error: '加载班级失败：' + (error.message || String(error)) }, 500);
  }
}
