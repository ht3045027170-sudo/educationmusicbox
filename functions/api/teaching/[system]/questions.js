import { json, requireTeacher } from '../../shared.js';

// GET /api/teaching/{system}/questions  已发布题库（供教师选题）
export async function onRequestGet({ request, env, params }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const auth = await requireTeacher(request, env);
    if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
    const system = String(params.system || '');
    if (!['hobby', 'gaokao'].includes(system)) return json({ ok: false, error: '未知的子系统。' }, 404);

    const { results } = await env.DB.prepare(
      "SELECT id, subject, knowledge_id, question_type, difficulty, content FROM questions " +
      "WHERE system_code = ? AND status = 'published' ORDER BY subject, id"
    ).bind(system).all();

    const items = results.map((row) => {
      let content = {};
      try { content = JSON.parse(row.content || '{}'); } catch {}
      return {
        id: row.id, subject: row.subject, knowledge_id: row.knowledge_id,
        question_type: row.question_type, difficulty: row.difficulty, content,
      };
    });
    return json({ items });
  } catch (error) {
    return json({ ok: false, error: '加载题库失败：' + (error.message || String(error)) }, 500);
  }
}
