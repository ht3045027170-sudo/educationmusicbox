const { app, BrowserWindow, session, shell } = require('electron');
const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const path = require('node:path');

let server;
let omrProcess;
let omrRuntime;
const product = /海棠艺考|HaitangExam/i.test(path.basename(process.execPath)) ? 'exam' : 'music';
const productTitle = product === 'exam' ? '海棠艺考' : '海棠音乐';

app.commandLine.appendSwitch('enable-features', 'WebMIDI');
app.setName(productTitle);

function findFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function requestJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { headers }, (response) => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { raw += chunk; });
      response.on('end', () => {
        try { resolve({ status: response.statusCode, value: JSON.parse(raw || '{}') }); }
        catch (error) { reject(error); }
      });
    });
    request.once('error', reject);
    request.setTimeout(5000, () => request.destroy(new Error('OMR health timeout')));
  });
}

async function waitForOmr(runtime) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    if (omrProcess?.exitCode !== null) throw new Error('本地识谱进程提前退出');
    try {
      const report = await requestJson(`http://127.0.0.1:${runtime.port}/health`, {
        'x-omr-service-token': runtime.token
      });
      if (report.status === 200) return report.value;
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  throw new Error('本地识谱模型启动超时');
}

async function startOmrService() {
  const bundledRoot = path.join(process.resourcesPath, 'offline-omr-engine');
  const developmentRoot = process.env.HETIAN_OMR_ENGINE || path.resolve(__dirname, '..', 'offline-omr-engine');
  const engineRoot = fs.existsSync(bundledRoot) ? bundledRoot : developmentRoot;
  const python = path.join(engineRoot, 'python', 'python.exe');
  const script = path.join(engineRoot, 'personal_omr_server.py');
  if (!fs.existsSync(python) || !fs.existsSync(script)) {
    throw new Error(`Windows 离线识谱引擎不完整：${engineRoot}`);
  }

  const port = await findFreePort();
  const token = crypto.randomBytes(32).toString('base64url');
  const configPath = path.join(app.getPath('userData'), 'omr-runtime.json');
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({ host: '127.0.0.1', port, serviceToken: token }), 'utf8');
  omrProcess = childProcess.spawn(python, [script, '--config', configPath], {
    cwd: engineRoot,
    windowsHide: true,
    stdio: 'ignore'
  });
  omrRuntime = { port, token };
  await waitForOmr(omrRuntime);
}

function proxyRequest(request, response, target, extraHeaders = {}) {
  const targetUrl = new URL(target);
  const headers = { ...request.headers, ...extraHeaders };
  delete headers.host;
  delete headers.connection;
  const upstream = (targetUrl.protocol === 'https:' ? https : http).request({
    protocol: targetUrl.protocol,
    hostname: targetUrl.hostname,
    port: targetUrl.port || undefined,
    method: request.method,
    path: targetUrl.pathname + targetUrl.search,
    headers
  }, (upstreamResponse) => {
    const responseHeaders = { ...upstreamResponse.headers, 'cache-control': 'no-store' };
    response.writeHead(upstreamResponse.statusCode || 502, responseHeaders);
    upstreamResponse.pipe(response);
  });
  upstream.once('error', (error) => {
    if (!response.headersSent) response.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: false, error: `服务连接失败：${error.message}` }));
  });
  request.pipe(upstream);
}

function handleOmrRequest(request, response, pathname) {
  if (!omrRuntime) {
    response.writeHead(503, { 'content-type': 'application/json; charset=utf-8' });
    return response.end(JSON.stringify({ ok: false, error: 'Windows 离线识谱模型尚未启动' }));
  }
  const endpoint = pathname.endsWith('/health') ? '/health' : pathname.endsWith('/recognize') ? '/recognize' : '';
  if (!endpoint) {
    response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    return response.end(JSON.stringify({ ok: false, error: 'Not found' }));
  }
  proxyRequest(request, response, `http://127.0.0.1:${omrRuntime.port}${endpoint}`, {
    'x-omr-service-token': omrRuntime.token
  });
}

function startLocalServer() {
  const appRoot = path.resolve(__dirname, 'app');
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.woff2': 'font/woff2'
  };
  server = http.createServer((request, response) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    } catch {
      response.writeHead(400);
      return response.end('Bad request');
    }

    if (pathname.startsWith('/api/omr/')) return handleOmrRequest(request, response, pathname);
    if (pathname.startsWith('/api/')) {
      return proxyRequest(request, response, `https://educationmusicbox.pages.dev${request.url}`);
    }

    const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const filePath = path.resolve(appRoot, relativePath);
    if (filePath !== appRoot && !filePath.startsWith(appRoot + path.sep)) {
      response.writeHead(403);
      return response.end('Forbidden');
    }
    fs.stat(filePath, (error, stat) => {
      if (error || !stat.isFile()) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        return response.end('Not found');
      }
      response.writeHead(200, {
        'content-type': mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff'
      });
      fs.createReadStream(filePath).once('error', () => response.destroy()).pipe(response);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

async function createWindow() {
  await startOmrService();
  const port = await startLocalServer();
  const allowedOrigin = `http://127.0.0.1:${port}`;
  const localUrl = `${allowedOrigin}/?product=${product}`;
  const isTrustedPage = (url) => {
    try { return new URL(url).origin === allowedOrigin; } catch { return false; }
  };
  const allowedPermissions = new Set(['media', 'midi', 'midiSysex']);
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestingUrl = details?.requestingUrl || webContents.getURL();
    callback(allowedPermissions.has(permission) && isTrustedPage(requestingUrl));
  });
  session.defaultSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    return allowedPermissions.has(permission) && isTrustedPage(requestingOrigin);
  });
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 390,
    minHeight: 620,
    backgroundColor: '#f5f7f4',
    title: productTitle,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedPage(url)) event.preventDefault();
  });
  await window.loadURL(localUrl);
}

app.whenReady().then(createWindow).catch((error) => {
  console.error(error);
  app.quit();
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => {
  server?.close();
  if (omrProcess && omrProcess.exitCode === null) omrProcess.kill();
});
