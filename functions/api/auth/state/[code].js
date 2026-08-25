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
  if (!row) return json({ state: null, updatedAt: null });
  try { return json({ state: JSON.parse(row.state_json), updatedAt: row.updated_at }); }
  catch { return json({ state: null, updatedAt: row.updated_at }); }
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
  const stateJson = JSON.stringify(body.state);
  if (stateJson.length > 1500000) return json({ ok: false, error: '学习数据过大，请先导出备份并清理旧记录。' }, 413);
  await ensureStates(env);
  await env.DB.prepare(
    'INSERT INTO user_learning_states (user_id, system_code, state_json, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id, system_code) DO UPDATE SET state_json = excluded.state_json, updated_at = CURRENT_TIMESTAMP'
  ).bind(user.id, code, stateJson).run();
  return json({ ok: true });
}
