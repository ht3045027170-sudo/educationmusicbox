import { json, readBody, verifyCsrfRequest, currentUser, ensureClassMessages, ensureCollaborationSchema } from '../../../../shared.js';

async function accessibleClass(env, system, classId, userId) {
  return env.DB.prepare(
    'SELECT DISTINCT c.id, c.name, c.teacher_id FROM classes c LEFT JOIN class_students cs ON cs.class_id = c.id ' +
    'WHERE c.id = ? AND c.system_code = ? AND (c.teacher_id = ? OR cs.student_id = ?)'
  ).bind(classId, system, userId, userId).first();
}

async function prepare(env) {
  await ensureClassMessages(env);
  await ensureCollaborationSchema(env);
}

export async function onRequestGet({ request, env, params }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const user = await currentUser(request, env);
    if (!user) return json({ ok: false, error: '请先登录后再查看班级消息。' }, 401);
    const system = String(params.system || ''), classId = Number(params.classId);
    if (!['hobby', 'gaokao'].includes(system)) return json({ ok: false, error: '未知的子系统。' }, 404);
    const cls = await accessibleClass(env, system, classId, user.id);
    if (!cls) return json({ ok: false, error: '班级不存在或你尚未加入。' }, 404);
    await prepare(env);

    const url = new URL(request.url);
    const keyword = String(url.searchParams.get('q') || '').trim().toLowerCase();
    const senderId = Number(url.searchParams.get('senderId') || 0);
    const messageId = Number(url.searchParams.get('messageId') || 0);
    const day = String(url.searchParams.get('date') || '').trim();
    const before = Number(url.searchParams.get('before') || 0);
    const searching = Boolean(keyword || senderId || day || messageId);
    const limit = searching ? 500 : 100;
    const beforeClause = before && !searching ? 'AND m.id < ? ' : '';
    const bindings = beforeClause ? [classId, before, limit] : [classId, limit];
    const { results: rows } = await env.DB.prepare(
      'SELECT m.id, m.sender_id, m.kind, m.content, m.assignment_id, m.created_at, u.username, u.display_name, u.role, ' +
      'x.reply_to, x.pinned_at, x.deleted_at, r.content AS reply_content, ru.display_name AS reply_name, ru.username AS reply_username ' +
      'FROM class_messages m LEFT JOIN users u ON u.id = m.sender_id ' +
      'LEFT JOIN class_message_meta x ON x.message_id = m.id ' +
      'LEFT JOIN class_messages r ON r.id = x.reply_to LEFT JOIN users ru ON ru.id = r.sender_id ' +
      `WHERE m.class_id = ? ${beforeClause}ORDER BY m.id DESC LIMIT ?`
    ).bind(...bindings).all();

    let items = rows.reverse();
    if (keyword) items = items.filter(row => `${row.content} ${row.display_name || row.username || ''}`.toLowerCase().includes(keyword));
    if (senderId) items = items.filter(row => Number(row.sender_id) === senderId);
    if (messageId) items = items.filter(row => Number(row.id) === messageId);
    if (day) items = items.filter(row => String(row.created_at || '').slice(0, 10) === day);
    items = items.map(row => ({
      ...row,
      content: row.deleted_at ? '该消息已被删除' : row.content,
      is_mine: Number(row.sender_id) === Number(user.id),
      can_delete: !row.deleted_at && (Number(row.sender_id) === Number(user.id) || Number(cls.teacher_id) === Number(user.id)),
      can_pin: !row.deleted_at && Number(cls.teacher_id) === Number(user.id),
    }));

    const settings = await env.DB.prepare('SELECT announcement FROM class_settings WHERE class_id = ?').bind(classId).first();
    const { results: students } = await env.DB.prepare(
      'SELECT u.id, u.username, u.display_name, u.role FROM class_students cs JOIN users u ON u.id = cs.student_id WHERE cs.class_id = ? ORDER BY cs.joined_at'
    ).bind(classId).all();
    const teacher = await env.DB.prepare('SELECT id, username, display_name, role FROM users WHERE id = ?').bind(cls.teacher_id).first();
    const { results: pinnedRows } = await env.DB.prepare(
      'SELECT m.id, m.content, m.created_at, u.username, u.display_name FROM class_message_meta x ' +
      'JOIN class_messages m ON m.id=x.message_id LEFT JOIN users u ON u.id=m.sender_id ' +
      'WHERE m.class_id=? AND x.pinned_at IS NOT NULL AND x.deleted_at IS NULL ORDER BY x.pinned_at DESC'
    ).bind(classId).all();
    if (!searching && !before && rows.length) {
      const latestMessageId = Math.max(...rows.map(row => Number(row.id) || 0));
      await env.DB.prepare(
        'INSERT INTO class_read_states (class_id,user_id,last_message_id,updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(class_id,user_id) DO UPDATE SET last_message_id=MAX(last_message_id,excluded.last_message_id),updated_at=CURRENT_TIMESTAMP'
      ).bind(classId, user.id, latestMessageId).run();
    }
    return json({
      class: { id: cls.id, name: cls.name, teacher_id: cls.teacher_id, member_count: students.length + 1, announcement: settings?.announcement || '' },
      viewer: { id: user.id, role: user.role, is_teacher: Number(cls.teacher_id) === Number(user.id) },
      members: [teacher, ...students].filter(Boolean),
      pinned: pinnedRows,
      items, has_more: !searching && rows.length === limit,
    });
  } catch (error) {
    return json({ ok: false, error: '加载班级消息失败：' + (error.message || String(error)) }, 500);
  }
}

export async function onRequestPost({ request, env, params }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const user = await currentUser(request, env);
    if (!user) return json({ ok: false, error: '请先登录后再发送消息。' }, 401);
    const csrfCheck = await verifyCsrfRequest(request, env);
    if (!csrfCheck.ok) return json({ ok: false, error: csrfCheck.error }, csrfCheck.status);
    const system = String(params.system || ''), classId = Number(params.classId);
    if (!['hobby', 'gaokao'].includes(system)) return json({ ok: false, error: '未知的子系统。' }, 404);
    const cls = await accessibleClass(env, system, classId, user.id);
    if (!cls) return json({ ok: false, error: '班级不存在或你尚未加入。' }, 404);
    const body = await readBody(request), content = String(body.content || '').trim(), replyTo = Number(body.replyTo || 0) || null;
    if (!content || content.length > 1000) return json({ ok: false, error: '消息长度需在 1-1000 字之间。' }, 400);
    await prepare(env);
    if (replyTo) {
      const reply = await env.DB.prepare('SELECT id FROM class_messages WHERE id = ? AND class_id = ?').bind(replyTo, classId).first();
      if (!reply) return json({ ok: false, error: '引用的消息不存在。' }, 400);
    }
    const result = await env.DB.prepare(
      "INSERT INTO class_messages (class_id, sender_id, kind, content) VALUES (?, ?, 'text', ?)"
    ).bind(classId, user.id, content).run();
    if (replyTo) await env.DB.prepare('INSERT INTO class_message_meta (message_id, reply_to) VALUES (?, ?)').bind(result.meta.last_row_id, replyTo).run();
    return json({ ok: true, id: result.meta.last_row_id });
  } catch (error) {
    return json({ ok: false, error: '发送消息失败：' + (error.message || String(error)) }, 500);
  }
}

export async function onRequestPatch({ request, env, params }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const user = await currentUser(request, env);
    if (!user) return json({ ok: false, error: '请先登录。' }, 401);
    const csrfCheck = await verifyCsrfRequest(request, env);
    if (!csrfCheck.ok) return json({ ok: false, error: csrfCheck.error }, csrfCheck.status);
    const system = String(params.system || ''), classId = Number(params.classId);
    const cls = await accessibleClass(env, system, classId, user.id);
    if (!cls) return json({ ok: false, error: '班级不存在或你尚未加入。' }, 404);
    await prepare(env);
    const body = await readBody(request), action = String(body.action || ''), messageId = Number(body.messageId || 0);
    const teacher = Number(cls.teacher_id) === Number(user.id);

    if (action === 'announcement') {
      if (!teacher) return json({ ok: false, error: '只有教师可以修改班级公告。' }, 403);
      const announcement = String(body.content || '').trim().slice(0, 2000);
      await env.DB.prepare(
        "INSERT INTO class_settings (class_id, announcement, updated_by, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(class_id) DO UPDATE SET announcement=excluded.announcement, updated_by=excluded.updated_by, updated_at=CURRENT_TIMESTAMP"
      ).bind(classId, announcement, user.id).run();
      return json({ ok: true });
    }

    const message = await env.DB.prepare('SELECT id, sender_id FROM class_messages WHERE id = ? AND class_id = ?').bind(messageId, classId).first();
    if (!message) return json({ ok: false, error: '消息不存在。' }, 404);
    if (action === 'pin' || action === 'unpin') {
      if (!teacher) return json({ ok: false, error: '只有教师可以管理置顶消息。' }, 403);
      await env.DB.prepare(
        "INSERT INTO class_message_meta (message_id, pinned_at, pinned_by) VALUES (?, CASE WHEN ?='pin' THEN CURRENT_TIMESTAMP END, ?) ON CONFLICT(message_id) DO UPDATE SET pinned_at=excluded.pinned_at, pinned_by=excluded.pinned_by"
      ).bind(messageId, action, user.id).run();
      return json({ ok: true });
    }
    if (action === 'delete') {
      if (!teacher && Number(message.sender_id) !== Number(user.id)) return json({ ok: false, error: '只能删除自己发送的消息。' }, 403);
      await env.DB.prepare(
        'INSERT INTO class_message_meta (message_id, deleted_at, deleted_by) VALUES (?, CURRENT_TIMESTAMP, ?) ON CONFLICT(message_id) DO UPDATE SET deleted_at=CURRENT_TIMESTAMP, deleted_by=excluded.deleted_by'
      ).bind(messageId, user.id).run();
      return json({ ok: true });
    }
    return json({ ok: false, error: '未知操作。' }, 400);
  } catch (error) {
    return json({ ok: false, error: '更新班级消息失败：' + (error.message || String(error)) }, 500);
  }
}
