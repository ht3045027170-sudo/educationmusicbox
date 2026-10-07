import { json, readBody, currentUser, verifyCsrfRequest } from '../shared.js';
import { entitlementFor, ensureEntitlements, hashCode } from '../entitlements.js';
export async function onRequestGet({request,env}) {
  if (!env.DB) return json({ok:false,error:'账号服务暂时不可用。'},503);
  const user = await currentUser(request,env);
  return json({ok:true,license:await entitlementFor(env,user)});
}
export async function onRequestPost({request,env}) {
  if (!env.DB) return json({ok:false,error:'账号服务暂时不可用。'},503);
  const user = await currentUser(request,env);
  if (!user) return json({ok:false,error:'请先登录后兑换。'},401);
  const csrf=await verifyCsrfRequest(request,env);if(!csrf.ok)return json({ok:false,error:csrf.error},csrf.status);
  const body=await readBody(request);const code=String(body.code || '').trim();
  if(!/^[A-Za-z0-9-]{24,64}$/.test(code))return json({ok:false,error:'兑换码无效，请核对后重试。'},400);
  await ensureEntitlements(env);
  const row=await env.DB.prepare('UPDATE entitlement_codes SET redeemed_by=?, redeemed_at=? WHERE code_hash=? AND revoked_at IS NULL AND (redeemed_by IS NULL OR redeemed_by=?) AND (expires_at IS NULL OR expires_at > ?) RETURNING plan')
    .bind(user.id,new Date().toISOString(),await hashCode(code),user.id,new Date().toISOString()).first();
  if(!row)return json({ok:false,error:'兑换码无效、已过期或已被其他账号使用。'},400);
  return json({ok:true,license:await entitlementFor(env,user)});
}
