import {json,requireTeacher,verifyCsrfRequest} from '../../../../shared.js';
import {ensureTuning,parseTargets,readTuningBody} from '../../../../tuning-shared.js';
async function authorize(request,env,params) {
  const auth=await requireTeacher(request,env);if(!auth.ok)return {response:json({ok:false,error:auth.error},auth.status)};
  const cls=await env.DB.prepare('SELECT id FROM classes WHERE id=? AND teacher_id=? AND system_code=?').bind(Number(params.classId),auth.user.id,String(params.system||'')).first();
  return cls ? {user:auth.user,classId:cls.id} : {response:json({ok:false,error:'班级不存在或无权访问。'},404)};
}
export async function onRequestPost({request,env,params}) {
  if(!env.DB)return json({ok:false,error:'账号服务暂时不可用。'},503);
  const auth=await authorize(request,env,params);if(auth.response)return auth.response;
  const csrf=await verifyCsrfRequest(request,env);if(!csrf.ok)return json({ok:false,error:csrf.error},csrf.status);
  const parsed=await readTuningBody(request);if(parsed.error)return json({ok:false,error:parsed.error},parsed.status);
  const body=parsed.body,title=String(body.title||'').trim(),targets=parseTargets(body.targets);
  if(!title||title.length>80||!targets||!['guitar','erhu'].includes(body.instrument))return json({ok:false,error:'请填写标题、乐器和1–12个不重复的C2–C6目标音。'},400);
  await ensureTuning(env);const token=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
  await env.DB.prepare('INSERT INTO tuning_lessons(token,class_id,title,instrument,targets_json) VALUES(?,?,?,?,?)').bind(token,auth.classId,title,body.instrument,JSON.stringify(targets)).run();
  return json({ok:true,token});
}
export async function onRequestGet({request,env,params}) {
  if(!env.DB)return json({ok:false,error:'账号服务暂时不可用。'},503);
  const auth=await authorize(request,env,params);if(auth.response)return auth.response;await ensureTuning(env);
  const {results:lessons}=await env.DB.prepare('SELECT token,title,instrument,targets_json,created_at FROM tuning_lessons WHERE class_id=? ORDER BY created_at DESC').bind(auth.classId).all();
  const {results:students}=await env.DB.prepare('SELECT u.id,u.display_name,u.username FROM class_students cs JOIN users u ON u.id=cs.student_id WHERE cs.class_id=?').bind(auth.classId).all();
  const {results:submissions}=await env.DB.prepare('SELECT s.* FROM tuning_submissions s JOIN tuning_lessons l ON l.token=s.lesson_token WHERE l.class_id=?').bind(auth.classId).all();
  return json({items:lessons.map(lesson=>({token:lesson.token,title:lesson.title,instrument:lesson.instrument,targets:JSON.parse(lesson.targets_json),created_at:lesson.created_at,students:students.map(student=>{
    const row=submissions.find(item=>item.lesson_token===lesson.token&&item.student_id===student.id);
    return {student_id:student.id,name:student.display_name||student.username,submitted_at:row?.submitted_at||null,completed:row?.completed||0,summary:row?JSON.parse(row.summary_json):[]};
  })}))});
}
