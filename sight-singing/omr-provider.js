(() => {
  'use strict';

  const HEALTH_ENDPOINT = '/api/omr/health';
  const RECOGNIZE_ENDPOINT = '/api/omr/recognize';
  const REMOTE_KEY = 'hetian_remote_omr_v1';

  function remoteConfig() {
    try { return JSON.parse(localStorage.getItem(REMOTE_KEY) || 'null'); }
    catch (_) { return null; }
  }

  function configureRemote(url, token) {
    const baseUrl = String(url || '').trim().replace(/\/+$/, '');
    const serviceToken = String(token || '').trim();
    if (!/^https:\/\/[^/]+/i.test(baseUrl)) throw new Error('请输入 https:// 开头的临时隧道地址');
    if (serviceToken.length < 24) throw new Error('识谱服务口令不完整');
    localStorage.setItem(REMOTE_KEY, JSON.stringify({ baseUrl, serviceToken }));
    return { baseUrl, serviceToken };
  }

  function clearRemote() { localStorage.removeItem(REMOTE_KEY); }
  function hasWindowsDesktopBridge() {
    return /Electron/i.test(navigator.userAgent)
      && ['127.0.0.1', 'localhost'].includes(location.hostname);
  }

  function parseNative(value) {
    if (typeof value === 'string') return JSON.parse(value);
    return value;
  }

  async function diagnoseAndroid() {
    if (!window.AndroidOMR || typeof window.AndroidOMR.health !== 'function') return null;
    try {
      const report = parseNative(window.AndroidOMR.health());
      return Object.assign({
        provider: 'android-native-homr',
        runtimeReady: false,
        modelsReady: false,
        ready: false
      }, report);
    } catch (error) {
      return {
        provider: 'android-native-homr',
        runtimeReady: false,
        modelsReady: false,
        ready: false,
        message: `Android 离线识谱桥不可用：${error.message}`
      };
    }
  }

  async function diagnoseDesktop() {
    // The Windows bridge exists only inside the packaged Electron app. Do not
    // probe a normal HTML browser, where the expected 404 would pollute logs.
    if (!hasWindowsDesktopBridge()) return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(HEALTH_ENDPOINT, {
        cache: 'no-store',
        signal: controller.signal
      });
      if (!response.ok) return null;
      const report = await response.json();
      if (report.provider !== 'windows-local-homr') return null;
      return report;
    } catch (_) {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function diagnoseRemote() {
    const config = remoteConfig();
    if (!config?.baseUrl || !config?.serviceToken) return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${config.baseUrl}/health`, {
        cache: 'no-store', signal: controller.signal,
        headers: { 'x-omr-service-token': config.serviceToken }
      });
      if (!response.ok) return null;
      const report = await response.json();
      return { ...report, provider: 'personal-remote-homr', ready: Boolean(report.ready ?? (report.runtimeReady && report.modelsReady)) };
    } catch (_) { return null; }
    finally { clearTimeout(timeout); }
  }

  async function diagnoseCloud() {
    if (location.protocol === 'file:' || hasWindowsDesktopBridge()) return null;
    try {
      const response = await fetch(HEALTH_ENDPOINT, { cache: 'no-store' });
      if (!response.ok) return null;
      const report = await response.json();
      return report?.provider === 'cloud-homr' ? report : null;
    } catch (_) { return null; }
  }

  async function diagnose() {
    const nativeReport = await diagnoseAndroid();
    if (nativeReport) return nativeReport;
    const desktopReport = await diagnoseDesktop();
    if (desktopReport) return desktopReport;
    const remoteReport = await diagnoseRemote();
    if (remoteReport) return remoteReport;
    const cloudReport = await diagnoseCloud();
    if (cloudReport) return cloudReport;
    return {
      ready: false,
      runtimeReady: typeof WebAssembly === 'object',
      modelsReady: false,
      provider: 'html-manual-review',
      engineVersion: 'none',
      modelVersion: '',
      message: '当前 HTML 浏览器环境未安装本机识谱桥，可继续使用图片增强与人工校对'
    };
  }

  async function recognizeAndroid(payload) {
    if (!window.AndroidOMR || typeof window.AndroidOMR.recognize !== 'function') {
      throw new Error('Android 离线识谱桥未安装');
    }
    const response = parseNative(window.AndroidOMR.recognize(JSON.stringify(payload)));
    if (!response?.ok) throw new Error(response?.error || 'Android 离线识谱失败');
    return response.result;
  }

  async function recognizeDesktop(payload) {
    const response = await fetch(RECOGNIZE_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      throw new Error(result.error || `Windows 离线识谱失败（${response.status}）`);
    }
    return result.result;
  }

  async function recognizeRemote(payload) {
    const config = remoteConfig();
    if (!config) throw new Error('尚未连接个人远程识谱服务');
    const response = await fetch(`${config.baseUrl}/recognize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-omr-service-token': config.serviceToken },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || `远程识谱失败（${response.status}）`);
    return result.result;
  }

  async function recognize(payload) {
    const report = await diagnose();
    if (!report.ready) {
      const error = new Error(`${report.message}。当前版本不会用模拟音符代替识别结果。`);
      error.code = 'OMR_NOT_READY';
      error.report = report;
      throw error;
    }
    if (report.provider === 'android-native-homr') return recognizeAndroid(payload);
    if (report.provider === 'windows-local-homr') return recognizeDesktop(payload);
    if (report.provider === 'personal-remote-homr') return recognizeRemote(payload);
    if (report.provider === 'cloud-homr') return recognizeDesktop(payload);
    throw new Error('没有可用的离线识谱执行器');
  }

  window.HetianOMR = {
    version: '1.3.0-personal-remote',
    license: 'AGPL-3.0',
    diagnose,
    recognize,
    configureRemote,
    clearRemote,
    getRemoteConfig: remoteConfig
  };
})();
