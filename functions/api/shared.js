// 简单的 JSON 响应工具（与 omr 函数保持一致风格）
const json = (value, status = 200, extraHeaders = {}) => new Response(JSON.stringify(value), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...extraHeaders,
  },
});

// 32 字节随机 token（十六进制字符串）
const randomToken = (bytes = 32) => {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('');
};

// 通用 cookie 解析
const parseCookies = (header) => {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = decodeURIComponent(part.slice(idx + 1).trim());
    if (key) out[key] = value;
  }
  return out;
};

// 获取客户端 IP（Cloudflare 注入的）
const clientIp = (request) => request.headers.get('cf-connecting-ip') || '';

// 安全比较（防止计时攻击）
const safeEqual = (a, b) => {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

// 唯一保留的总管理员教师身份。公开注册只能创建 learner；这里还要求该
// 保留账号原本已具备 teacher/admin 角色，避免仅靠抢注用户名获得权限。
const effectiveRole = (user) => {
  const reserved = String(user?.username || '').toLowerCase() === 'admin'
    && String(user?.email || '').toLowerCase() === 'admin@haitang.local';
  return reserved && ['teacher', 'admin'].includes(user?.role) ? 'admin' : user?.role;
};

// PBKDF2-SHA256 密码哈希（10 万次迭代，符合当前业界基准）
const bytesToHex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
const hexToBytes = (h) => {
  const r = new Uint8Array(Math.floor(h.length / 2));
  for (let i = 0; i < r.length; i++) r[i] = parseInt(h.substr(i * 2, 2), 16);
  return r;
};
const pbkdf2 = async (password, saltBytes) => {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
    key, 256,
  );
  return new Uint8Array(bits);
};
const hashPassword = async (password) => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt);
  return { salt: bytesToHex(salt), hash: bytesToHex(hash) };
};
const verifyPassword = async (password, saltHex, expectedHashHex) => {
  const hash = await pbkdf2(password, hexToBytes(saltHex));
  return bytesToHex(hash) === expectedHashHex;
};

// CSRF token 校验中间件逻辑（POST/PUT/DELETE 通用）
const requireCsrf = (request, session) => {
  const headerToken = request.headers.get('x-csrf-token') || '';
  if (!session) return { ok: false, error: '请先登录后再操作。', status: 401 };
  if (!safeEqual(headerToken, session.csrf)) return { ok: false, error: '安全令牌失效，请刷新页面重试。', status: 403 };
  return { ok: true };
};

// 会话级 CSRF 校验：从 cookie 取 mb_sid，查 sessions 表比对 x-csrf-token 头
// 登录/注册/忘记密码等匿名会话接口也用它（只要前端先 GET /api/csrf 拿过令牌）
const verifyCsrfRequest = async (request, env) => {
  const cookies = parseCookies(request.headers.get('cookie'));
  const sid = cookies.mb_sid || '';
  if (!sid) return { ok: false, error: '会话缺失，请刷新页面后重试。', status: 403 };
  const row = await env.DB.prepare(
    'SELECT csrf FROM sessions WHERE token = ? AND expires_at > ?'
  ).bind(sid, new Date().toISOString()).first();
  if (!row || row.csrf === 'pending') {
    return { ok: false, error: '会话已过期，请刷新页面后重试。', status: 403 };
  }
  const headerToken = request.headers.get('x-csrf-token') || '';
  if (!safeEqual(headerToken, row.csrf)) {
    return { ok: false, error: '安全令牌校验失败，请刷新页面后重试。', status: 403 };
  }
  return { ok: true, sid };
};

// 从 cookie 会话解析当前登录用户（含角色）；未登录/过期返回 null
const currentUser = async (request, env) => {
  const cookies = parseCookies(request.headers.get('cookie'));
  const sid = cookies.mb_sid || '';
  if (!sid) return null;
  const row = await env.DB.prepare(
    'SELECT u.id, u.username, u.email, u.display_name, u.role, u.learning_system, u.status ' +
    'FROM sessions s JOIN users u ON u.id = s.user_id ' +
    'WHERE s.token = ? AND s.expires_at > ?'
  ).bind(sid, new Date().toISOString()).first();
  if (!row || row.status !== 'active') return null;
  row.role = effectiveRole(row);
  return row;
};

// 教师端鉴权：登录 + teacher/admin 角色
const requireTeacher = async (request, env) => {
  const user = await currentUser(request, env);
  if (!user) return { ok: false, error: '请先登录后再操作。', status: 401 };
  if (!['teacher', 'admin'].includes(user.role)) {
    return { ok: false, error: '仅教师或管理员账号可使用教师中心。', status: 403 };
  }
  return { ok: true, user };
};

const ensureClassMessages = async (env) => {
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS class_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, class_id INTEGER NOT NULL, sender_id INTEGER, kind TEXT NOT NULL DEFAULT 'text', content TEXT NOT NULL, assignment_id INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE, FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE SET NULL, FOREIGN KEY(assignment_id) REFERENCES homework_assignments(id) ON DELETE CASCADE)"
  ).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_class_messages_class_time ON class_messages(class_id, created_at)').run();
};

// 班级协作与套题采用附加表扩展旧数据，不改动已有账号、题库和作业主表。
const ensureCollaborationSchema = async (env) => {
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS class_settings (class_id INTEGER PRIMARY KEY, announcement TEXT NOT NULL DEFAULT '', updated_by INTEGER, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS class_message_meta (message_id INTEGER PRIMARY KEY, reply_to INTEGER, pinned_at TEXT, pinned_by INTEGER, deleted_at TEXT, deleted_by INTEGER, FOREIGN KEY(message_id) REFERENCES class_messages(id) ON DELETE CASCADE, FOREIGN KEY(reply_to) REFERENCES class_messages(id) ON DELETE SET NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS class_read_states (class_id INTEGER NOT NULL, user_id INTEGER NOT NULL, last_message_id INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(class_id,user_id), FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS assignment_settings (assignment_id INTEGER PRIMARY KEY, allow_retry INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER, score_policy TEXT NOT NULL DEFAULT 'highest', deleted_at TEXT, question_set_id INTEGER, announce_in_chat INTEGER NOT NULL DEFAULT 1, FOREIGN KEY(assignment_id) REFERENCES homework_assignments(id) ON DELETE CASCADE)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS homework_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, assignment_id INTEGER NOT NULL, student_id INTEGER NOT NULL, attempt_no INTEGER NOT NULL, answers TEXT NOT NULL, score REAL NOT NULL DEFAULT 0, wrong_count INTEGER NOT NULL DEFAULT 0, started_at TEXT, submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(assignment_id) REFERENCES homework_assignments(id) ON DELETE CASCADE, FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE, UNIQUE(assignment_id, student_id, attempt_no))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS question_sets (id INTEGER PRIMARY KEY AUTOINCREMENT, system_code TEXT NOT NULL, teacher_id INTEGER NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', sections_json TEXT NOT NULL DEFAULT '[]', total_score REAL NOT NULL DEFAULT 0, estimated_duration INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, deleted_at TEXT, FOREIGN KEY(teacher_id) REFERENCES users(id) ON DELETE CASCADE)"),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_attempts_assignment_student ON homework_attempts(assignment_id, student_id, attempt_no)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_question_sets_teacher ON question_sets(teacher_id, system_code, updated_at)'),
  ]);
};

// 统一读取请求体
const readBody = async (request) => {
  const ct = (request.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) return request.json().catch(() => ({}));
  const text = await request.text().catch(() => '');
  if (!text) return {};
  if (ct.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(text));
  }
  try { return JSON.parse(text); } catch { return {}; }
};

// 设置 session cookie + 返回新会话
const issueSession = async (env, userId, request) => {
  const token = randomToken(32);
  const csrf = randomToken(24);
  const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(); // 30 天
  await env.DB.prepare(
    'INSERT INTO sessions (token, user_id, csrf, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(token, userId, csrf, expiresAt, clientIp(request), (request.headers.get('user-agent') || '').slice(0, 255)).run();
  return { token, csrf, expiresAt };
};

const cookieAttrs = (maxAgeSec = 30 * 24 * 3600) =>
  `mb_sid=${''}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}`;

export {
  json, randomToken, parseCookies, clientIp, safeEqual,
  bytesToHex, hexToBytes, hashPassword, verifyPassword, pbkdf2,
  requireCsrf, verifyCsrfRequest, readBody, issueSession, cookieAttrs,
  currentUser, requireTeacher, effectiveRole, ensureClassMessages, ensureCollaborationSchema,
};
