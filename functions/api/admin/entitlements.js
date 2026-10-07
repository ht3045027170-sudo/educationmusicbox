import { json, readBody, currentUser, verifyCsrfRequest } from '../shared.js';
import { ensureEntitlements, hashCode } from '../entitlements.js';
export async function onRequestPost({request,env}) {
  if(!env.DB)return json({ok:false,error:'账号服务暂时不可用。'},503);
  const user=await currentUser(request,env);
  if(!user || user.role!=='admin')return json({ok:false,error:'仅服务端管理员可签发兑换码。'},403);
  const csrf=await verifyCsrfRequest(request,env);if(!csrf.ok)return json({ok:false,error:csrf.error},csrf.status);
  const body=await readBody(request);
  if(!['student_pro','ai_teacher','teacher'].includes(body.plan))return json({ok:false,error:'请选择有效的会员方案。'},400);
  const days=Number(body.days || 30);if(!Number.isInteger(days)||days<1||days>366)return json({ok:false,error:'有效期需为1–366天。'},400);
  const bytes=crypto.getRandomValues(new Uint8Array(16));const code=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
  const expiresAt=new Date(Date.now()+days*86400000).toISOString();await ensureEntitlements(env);
  await env.DB.prepare('INSERT INTO entitlement_codes(code_hash,plan,expires_at,created_by) VALUES(?,?,?,?)').bind(await hashCode(code),body.plan,expiresAt,user.id).run();
  return json({ok:true,code,plan:body.plan,expiresAt});
}
