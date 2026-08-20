const { app, BrowserWindow, session, shell } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

let server;

// Chromium exposes Web MIDI only when it is explicitly available to the
// renderer. Keeping this opt-in here makes the packaged desktop app behave
// like a normal trusted localhost music application.
app.commandLine.appendSwitch('enable-features', 'WebMIDI');

function startLocalServer() {
  const appRoot = path.resolve(__dirname, 'app');
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg'
  };
  server = http.createServer((request, response) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    } catch {
      response.writeHead(400);
      return response.end('Bad request');
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
  const port = await startLocalServer();
  const allowedOrigin = `http://127.0.0.1:${port}`;
  const isTrustedLocalPage = (url) => {
    try { return new URL(url).origin === allowedOrigin; } catch { return false; }
  };
  const allowedPermissions = new Set(['media', 'midi', 'midiSysex']);
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestingUrl = details?.requestingUrl || webContents.getURL();
    callback(allowedPermissions.has(permission) && isTrustedLocalPage(requestingUrl));
  });
  session.defaultSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    return allowedPermissions.has(permission) && isTrustedLocalPage(requestingOrigin);
  });
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 390,
    minHeight: 620,
    backgroundColor: '#f5f7f4',
    title: '和田玉音乐教育工具箱',
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
    if (!url.startsWith(allowedOrigin)) event.preventDefault();
  });
  await window.loadURL(allowedOrigin);
}

app.whenReady().then(createWindow).catch((error) => {
  console.error(error);
  app.quit();
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => server?.close());
