import {json,currentUser,verifyCsrfRequest} from '../shared.js';
import {ensureTuning,validateSummary,readTuningBody} from '../tuning-shared.js';
async function lesson(env,token) {await ensureTuning(env);return env.DB.prepare('SELECT token,class_id,title,instrument,targets_json FROM tuning_lessons WHERE token=?').bind(String(token)).first();}
export async function onRequestGet({request,env,params}) {
  if(!env.DB)return json({ok:false,error:'练习服务暂时不可用。'},503);
  const row=await lesson(env,params.token);if(!row)return json({ok:false,error:'练习链接无效。'},404);
  // The shared token reveals only the intended exercise, never class members or submissions.
  return json({ok:true,lesson:{token:row.token,title:row.title,instrument:row.instrument,targets:JSON.parse(row.targets_json)}});
}
export async function onRequestPost({request,env,params}) {
  if(!env.DB)return json({ok:false,error:'练习服务暂时不可用。'},503);
  const user=await currentUser(request,env);if(!user)return json({ok:false,error:'调音无需登录。保存给老师需要先登录班级账号。'},401);
  const csrf=await verifyCsrfRequest(request,env);if(!csrf.ok)return json({ok:false,error:csrf.error},csrf.status);
  const row=await lesson(env,params.token);if(!row)return json({ok:false,error:'练习链接无效。'},404);
  const member=await env.DB.prepare('SELECT student_id FROM class_students WHERE class_id=? AND student_id=?').bind(row.class_id,user.id).first();
  if(!member)return json({ok:false,error:'你尚未加入老师的班级，请先用邀请码加入。'},403);
  const parsed=await readTuningBody(request);if(parsed.error)return json({ok:false,error:parsed.error},parsed.status);
  const body=parsed.body;
  if(Number(body.userId)!==user.id)return json({ok:false,error:'登录账号已变化，请重新保存。'},409);
  if(body.consent!==true)return json({ok:false,error:'请确认将检测摘要保存给老师。'},400);
  const summary=validateSummary(body.summary,JSON.parse(row.targets_json));if(!summary)return json({ok:false,error:'检测摘要无效，请重新练习。'},400);
  const completed=summary.filter(item=>item.complete).length;
  await env.DB.prepare('INSERT INTO tuning_submissions(lesson_token,student_id,summary_json,completed,submitted_at) VALUES(?,?,?,?,?) ON CONFLICT(lesson_token,student_id) DO UPDATE SET summary_json=excluded.summary_json,completed=excluded.completed,submitted_at=excluded.submitted_at').bind(row.token,user.id,JSON.stringify(summary),completed,new Date().toISOString()).run();
  return json({ok:true,completed,total:summary.length});
}
