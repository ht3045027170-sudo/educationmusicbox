const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

export async function onRequestPost({ request, env }) {
  if (!env.OMR_SERVICE_URL || !env.OMR_SERVICE_TOKEN) return json({ ok: false, error: '云端识谱服务尚未配置。' }, 503);
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 46 * 1024 * 1024) return json({ ok: false, error: '图片过大，请先裁切或压缩后再识别。' }, 413);
  try {
    const upstream = await fetch(new URL('/recognize', env.OMR_SERVICE_URL).toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-omr-service-token': env.OMR_SERVICE_TOKEN },
      body: await request.text()
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
  } catch (_) {
    return json({ ok: false, error: '云端识谱服务暂时不可用，请稍后重试。' }, 503);
  }
}
