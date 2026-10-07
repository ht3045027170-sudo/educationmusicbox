import { json, currentUser, verifyCsrfRequest } from '../shared.js';

export const MAX_BODY_BYTES = 46 * 1024 * 1024;
async function boundedBody(request) {
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) return null;
  if (!request.body) return '';
  const reader = request.body.getReader(), chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false, error: '账号服务暂时不可用。' }, 503);
  try {
    const user = await currentUser(request, env);
    if (!user) return json({ ok: false, error: '请先登录后使用云端识谱；也可继续手动校对。' }, 401);
    const csrf = await verifyCsrfRequest(request, env);
    if (!csrf.ok) return json({ ok: false, error: csrf.error }, csrf.status);
    if (!env.OMR_SERVICE_URL || !env.OMR_SERVICE_TOKEN) return json({ ok: false, error: '云端识谱服务尚未配置。' }, 503);
    const body = await boundedBody(request);
    if (body === null) return json({ ok: false, error: '图片过大，请先裁切或压缩后再识别。' }, 413);
    let payload;
    try { payload = JSON.parse(body); } catch { return json({ ok: false, error: '识谱请求格式无效。' }, 400); }
    if (!payload || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(payload.imageDataUrl || '')) {
      return json({ ok: false, error: '请提供 PNG、JPEG 或 WebP 图片。' }, 400);
    }
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS omr_daily_usage (user_id INTEGER NOT NULL, day TEXT NOT NULL, requests INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(user_id,day))').run();
    const day = new Date().toISOString().slice(0, 10);
    const limit = Math.max(1, Math.min(100, Number(env.OMR_DAILY_LIMIT) || 20));
    // Atomic increment avoids simultaneous requests bypassing the quota.
    const usage = await env.DB.prepare('INSERT INTO omr_daily_usage (user_id, day, requests) VALUES (?, ?, 1) ON CONFLICT(user_id,day) DO UPDATE SET requests=requests+1 WHERE requests < ? RETURNING requests')
      .bind(user.id, day, limit).first();
    if (!usage) return json({ ok: false, error: `今日云端识谱已达 ${limit} 次，请明天再试或使用手动校对。` }, 429);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(100, Math.min(60000, Number(env.OMR_TIMEOUT_MS) || 30000)));
    try {
      const upstream = await fetch(new URL('/recognize', env.OMR_SERVICE_URL), {
        method: 'POST', signal: controller.signal,
        headers: { 'content-type': 'application/json', 'x-omr-service-token': env.OMR_SERVICE_TOKEN },
        body: JSON.stringify({ imageDataUrl: payload.imageDataUrl, preprocessing: payload.preprocessing })
      });
      if (!upstream.ok) return json({ ok: false, error: '识谱服务处理失败，可稍后重试或手动校对。' }, 502);
      const result = await upstream.json();
      if (!result.ok || !result.result) return json({ ok: false, error: '识谱服务未返回有效结果，请手动校对。' }, 502);
      return json({ ok: true, result: result.result, remaining: limit - usage.requests });
    } catch (_) {
      return json({ ok: false, error: controller.signal.aborted ? '识谱等待超时，请裁切图片后重试或手动校对。' : '云端识谱服务暂时不可用，请稍后重试。' }, controller.signal.aborted ? 504 : 503);
    } finally { clearTimeout(timeout); }
  } catch (_) { return json({ ok: false, error: '云端识谱暂时无法处理请求，请稍后重试。' }, 503); }
}
