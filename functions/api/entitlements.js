export const PLANS = Object.freeze({
  free:['basic_tools','guest_mode','ear_basic','theory_chapter_1','theory_chapter_2'],
  student_pro:['basic_tools','guest_mode','ear_basic','advanced_level','theory_full','reports','voice_training','sight_singing'],
  ai_teacher:['basic_tools','advanced_level','theory_full','reports','voice_training','sight_singing','ai_analysis'],
  teacher:['basic_tools','advanced_level','theory_full','reports','voice_training','sight_singing','teacher_question_bank','classroom_management'],
  developer:['*']
});
export async function ensureEntitlements(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS entitlement_codes (code_hash TEXT PRIMARY KEY, plan TEXT NOT NULL, expires_at TEXT, redeemed_by INTEGER, redeemed_at TEXT, revoked_at TEXT, created_by INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
}
export async function hashCode(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value).trim().toUpperCase()));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2,'0')).join('');
}
export async function entitlementFor(env, user) {
  let type = 'free', expireDate = '';
  if (user?.role === 'admin') type = 'developer';
  else if (user?.role === 'teacher') type = 'teacher';
  else if (user) {
    await ensureEntitlements(env);
    const row = await env.DB.prepare('SELECT plan, expires_at FROM entitlement_codes WHERE redeemed_by=? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?) ORDER BY redeemed_at DESC, created_at DESC LIMIT 1')
      .bind(user.id, new Date().toISOString()).first();
    if (row && PLANS[row.plan] && row.plan !== 'developer') { type = row.plan; expireDate = row.expires_at || ''; }
  }
  return { type, status:'active', expireDate, features:PLANS[type], userId:user?.id || null, verified:true };
}
