import { json, readBody, verifyCsrfRequest, requireTeacher, ensureCollaborationSchema } from '../../../shared.js';

export async function onRequestGet({ request, env, params }) {
  if (!env.DB) return json({ ok:false, error:'服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const auth=await requireTeacher(request,env); if(!auth.ok)return json({ok:false,error:auth.error},auth.status);
    await ensureCollaborationSchema(env);
    const row=await env.DB.prepare('SELECT * FROM question_sets WHERE id=? AND teacher_id=? AND system_code=? AND deleted_at IS NULL').bind(Number(params.id),auth.user.id,String(params.system||'')).first();
    if(!row)return json({ok:false,error:'套题不存在或无权访问。'},404);
    let sections=[];try{sections=JSON.parse(row.sections_json||'[]')}catch{}
    return json({item:{...row,sections}});
  }catch(error){return json({ok:false,error:'加载套题失败：'+(error.message||String(error))},500)}
}

export async function onRequestPut({ request, env, params }) {
  if (!env.DB) return json({ ok:false, error:'服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const auth=await requireTeacher(request,env); if(!auth.ok)return json({ok:false,error:auth.error},auth.status);
    const csrf=await verifyCsrfRequest(request,env);if(!csrf.ok)return json({ok:false,error:csrf.error},csrf.status);
    await ensureCollaborationSchema(env);
    const body=await readBody(request), sections=Array.isArray(body.sections)?body.sections:[];
    const totalScore=sections.reduce((sum,section)=>sum+(section.questions||[]).reduce((part,item)=>part+Math.max(0,Number(item.score||1)),0),0);
    const result=await env.DB.prepare('UPDATE question_sets SET title=?,description=?,sections_json=?,total_score=?,estimated_duration=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND teacher_id=? AND system_code=? AND deleted_at IS NULL').bind(String(body.title||'').trim().slice(0,120),String(body.description||'').trim().slice(0,2000),JSON.stringify(sections),totalScore,Math.max(0,Number(body.estimatedDuration||0)),body.status==='published'?'published':'draft',Number(params.id),auth.user.id,String(params.system||'')).run();
    if(!result.meta?.changes)return json({ok:false,error:'套题不存在或无权修改。'},404);
    return json({ok:true});
  }catch(error){return json({ok:false,error:'更新套题失败：'+(error.message||String(error))},500)}
}

export async function onRequestDelete({ request, env, params }) {
  if (!env.DB) return json({ ok:false, error:'服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const auth=await requireTeacher(request,env); if(!auth.ok)return json({ok:false,error:auth.error},auth.status);
    const csrf=await verifyCsrfRequest(request,env);if(!csrf.ok)return json({ok:false,error:csrf.error},csrf.status);
    await ensureCollaborationSchema(env);
    const result=await env.DB.prepare('UPDATE question_sets SET deleted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND teacher_id=? AND system_code=?').bind(Number(params.id),auth.user.id,String(params.system||'')).run();
    if(!result.meta?.changes)return json({ok:false,error:'套题不存在或无权删除。'},404);
    return json({ok:true});
  }catch(error){return json({ok:false,error:'删除套题失败：'+(error.message||String(error))},500)}
}
