import { json, currentUser } from '../shared.js';

// GET /api/admin/session
// 管理后台会话探测：复用主站登录 Cookie。
// - 未登录 / 普通学习者 → { manager: null }，后台停留在登录页
// - teacher / admin 角色 → 进入「内容中心」模式，教师中心标签可见
//   （平台管理员专属的登录日志/IP 封禁等标签后续实现 admin API 后再开放）
export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ manager: null });
  try {
    const user = await currentUser(request, env);
    if (!user || !['teacher', 'admin'].includes(user.role)) {
      return json({ manager: null });
    }
    return json({
      manager: {
        platform: false,
        username: user.display_name || user.username,
        role: user.role,
        systems: [
          { system_code: 'hobby', role: user.role },
          { system_code: 'gaokao', role: user.role },
        ],
      },
    });
  } catch (err) {
    return json({ manager: null });
  }
}
