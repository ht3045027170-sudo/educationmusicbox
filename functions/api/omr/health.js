const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

function endpoint(env, path) {
  if (!env.OMR_SERVICE_URL) return null;
  return new URL(path, env.OMR_SERVICE_URL).toString();
}

export async function onRequestGet({ env }) {
  const url = endpoint(env, '/health');
  if (!url) return json({ ready: false, provider: 'cloud-homr', message: '云端识谱服务尚未配置。' }, 503);
  try {
    const response = await fetch(url, { headers: { 'x-omr-service-token': env.OMR_SERVICE_TOKEN || '' } });
    const report = await response.json();
    return json({ ...report, provider: 'cloud-homr' }, response.status);
  } catch (_) {
    return json({ ready: false, provider: 'cloud-homr', message: '云端识谱服务暂时不可用。' }, 503);
  }
}
