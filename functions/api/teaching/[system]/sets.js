import { json, readBody, verifyCsrfRequest, requireTeacher, ensureCollaborationSchema } from '../../shared.js';

const SYSTEMS = ['hobby', 'gaokao'];

export async function onRequestGet({ request, env, params }) {
  if (!env.DB) return json({ ok:false, error:'服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const auth = await requireTeacher(request, env);
    if (!auth.ok) return json({ ok:false, error:auth.error }, auth.status);
    const system = String(params.system || '');
    if (!SYSTEMS.includes(system)) return json({ ok:false, error:'未知的子系统。' }, 404);
    await ensureCollaborationSchema(env);
    const { results } = await env.DB.prepare(
      'SELECT id,title,description,sections_json,total_score,estimated_duration,status,created_at,updated_at FROM question_sets WHERE system_code=? AND teacher_id=? AND deleted_at IS NULL ORDER BY updated_at DESC'
    ).bind(system, auth.user.id).all();
    return json({ items: results.map(row => ({ ...row, sections: parseSections(row.sections_json), section_count: parseSections(row.sections_json).length })) });
  } catch (error) { return json({ ok:false, error:'加载套题失败：' + (error.message || String(error)) }, 500); }
}

export async function onRequestPost({ request, env, params }) {
  if (!env.DB) return json({ ok:false, error:'服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const auth = await requireTeacher(request, env);
    if (!auth.ok) return json({ ok:false, error:auth.error }, auth.status);
    const csrf = await verifyCsrfRequest(request, env);
    if (!csrf.ok) return json({ ok:false, error:csrf.error }, csrf.status);
    const system = String(params.system || ''), body = await readBody(request);
    if (!SYSTEMS.includes(system)) return json({ ok:false, error:'未知的子系统。' }, 404);
    const normalized = normalizeSet(body);
    if (!normalized.title) return json({ ok:false, error:'请填写套题名称。' }, 400);
    if (!normalized.sections.length) return json({ ok:false, error:'套题至少需要一个大题。' }, 400);
    await ensureCollaborationSchema(env);
    const questionIds = normalized.sections.flatMap(section => section.questions.map(item => item.questionId));
    if (questionIds.length) {
      const placeholders = questionIds.map(() => '?').join(',');
      const row = await env.DB.prepare(`SELECT COUNT(*) AS count FROM questions WHERE id IN (${placeholders}) AND system_code=?`).bind(...questionIds, system).first();
      if (Number(row?.count || 0) !== new Set(questionIds).size) return json({ ok:false, error:'套题中存在无效或跨系统题目。' }, 400);
    }
    const result = await env.DB.prepare(
      'INSERT INTO question_sets (system_code,teacher_id,title,description,sections_json,total_score,estimated_duration,status) VALUES (?,?,?,?,?,?,?,?)'
    ).bind(system, auth.user.id, normalized.title, normalized.description, JSON.stringify(normalized.sections), normalized.totalScore, normalized.estimatedDuration, normalized.status).run();
    return json({ ok:true, id:result.meta.last_row_id });
  } catch (error) { return json({ ok:false, error:'保存套题失败：' + (error.message || String(error)) }, 500); }
}

function parseSections(value) { try { const parsed=JSON.parse(value||'[]'); return Array.isArray(parsed)?parsed:[]; } catch { return []; } }
function normalizeSet(body) {
  const sections = (Array.isArray(body.sections) ? body.sections : []).slice(0,20).map((section,index) => ({
    id:String(section.id || `section-${index+1}`).slice(0,80),
    title:String(section.title || `第${index+1}部分`).trim().slice(0,100),
    type:['dictation','notation','theory','sight_singing','mixed'].includes(section.type)?section.type:'mixed',
    order:index+1,
    questions:(Array.isArray(section.questions)?section.questions:[]).slice(0,100).map((item,questionIndex)=>({questionId:Number(item.questionId),score:Math.max(0,Number(item.score||1)),order:questionIndex+1})).filter(item=>Number.isInteger(item.questionId)&&item.questionId>0),
  }));
  const totalScore = sections.reduce((sum,section)=>sum+section.questions.reduce((part,item)=>part+item.score,0),0);
  return { title:String(body.title||'').trim().slice(0,120), description:String(body.description||'').trim().slice(0,2000), sections, totalScore, estimatedDuration:Math.max(0,Math.min(600,Number(body.estimatedDuration||0))), status:body.status==='published'?'published':'draft' };
}
