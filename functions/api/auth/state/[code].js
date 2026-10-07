import { json, readBody, verifyCsrfRequest, currentUser } from '../../shared.js';

async function ensureStates(env) {
  await env.DB.prepare(
    'CREATE TABLE IF NOT EXISTS user_learning_states (user_id INTEGER NOT NULL, system_code TEXT NOT NULL, state_json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id, system_code), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)'
  ).run();
}

export async function onRequestGet({ request, env, params }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  const user = await currentUser(request, env);
  if (!user) return json({ ok: false, error: '请先登录。' }, 401);
  const code = String(params.code || '');
  if (!['hobby', 'gaokao'].includes(code)) return json({ ok: false, error: '未知的系统。' }, 404);
  await ensureStates(env);
  const row = await env.DB.prepare(
    'SELECT state_json, updated_at FROM user_learning_states WHERE user_id = ? AND system_code = ?'
  ).bind(user.id, code).first();
  if (!row) return json({ state: null, updatedAt: null, revision: null, userId: user.id });
  try { return json({ state: JSON.parse(row.state_json), updatedAt: row.updated_at, revision: row.updated_at, userId: user.id }); }
  catch { return json({ state: null, updatedAt: row.updated_at, revision: row.updated_at, userId: user.id }); }
}

export async function onRequestPut({ request, env, params }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  const user = await currentUser(request, env);
  if (!user) return json({ ok: false, error: '请先登录。' }, 401);
  const csrfCheck = await verifyCsrfRequest(request, env);
  if (!csrfCheck.ok) return json({ ok: false, error: csrfCheck.error }, csrfCheck.status);
  const code = String(params.code || '');
  if (!['hobby', 'gaokao'].includes(code)) return json({ ok: false, error: '未知的系统。' }, 404);
  const body = await readBody(request);
  if (!body.state || typeof body.state !== 'object' || Array.isArray(body.state)) {
    return json({ ok: false, error: '学习数据格式不正确。' }, 400);
  }
  if (String(body.userId || '') !== String(user.id)) return json({ ok: false, error: '登录账号已改变，请重新载入后同步。' }, 409);
  if (!Object.hasOwn(body, 'expectedRevision')) return json({ ok:false, error:'请刷新页面后同步新版学习数据。' }, 428);
  const safeState = { ...body.state }; delete safeState.license; delete safeState.unlockState;
  const stateJson = JSON.stringify(safeState);
  if (stateJson.length > 1500000) return json({ ok: false, error: '学习数据过大，请先导出备份并清理旧记录。' }, 413);
  await ensureStates(env);
  if (body.expectedRevision !== null) {
    const existing = await env.DB.prepare('SELECT updated_at FROM user_learning_states WHERE user_id=? AND system_code=?').bind(user.id, code).first();
    if (!existing) return json({ok:false,conflict:true,error:'云端数据已改变，请重新确认后同步。'},409);
  }
  const revision = new Date().toISOString() + ':' + crypto.randomUUID();
  const result = await env.DB.prepare(
    'INSERT INTO user_learning_states (user_id, system_code, state_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, system_code) DO UPDATE SET state_json=excluded.state_json, updated_at=excluded.updated_at WHERE user_learning_states.updated_at = ?'
  ).bind(user.id, code, stateJson, revision, body.expectedRevision ?? '').run();
  if (!result.meta?.changes) return json({ ok:false, conflict:true, error:'另一台设备已更新学习数据，请选择保留哪一份。' }, 409);
  return json({ ok:true, revision, userId:user.id });
}
