(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let csrfToken = '';

  async function csrf() {
    if (csrfToken) return csrfToken;
    const r = await fetch('/api/csrf');
    csrfToken = (await r.json()).csrfToken;
    return csrfToken;
  }

  async function api(url, options = {}) {
    const method = options.method || 'GET';
    const headers = { ...(options.headers || {}) };
    if (!['GET', 'HEAD'].includes(method)) headers['x-csrf-token'] = await csrf();
    const response = await fetch(url, { ...options, headers, credentials: 'same-origin' });
    const body = response.status === 204 ? null : await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.message || body?.error || '请求失败');
    return body;
  }

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const roleName = { learner: '学习者', teacher: '教师', admin: '管理员' };
  const systemName = (code) => code === 'hobby' ? '音乐爱好者' : '高考音乐生';

  function enter(manager) {
    $('loginCard').hidden = true;
    $('dashboard').hidden = false;
    window.CONTENT_MANAGER = manager;
    const label = manager.platform ? '平台管理员' : (roleName[manager.role] || '教师');
    $('adminIdentity').textContent = `${label}：${manager.username}`;
    document.body.classList.add('content-manager');

    // Tab switching: show/hide sections
    document.querySelector('nav').onclick = (event) => {
      const tab = event.target.dataset.tab;
      if (!tab) return;
      document.querySelectorAll('.tab').forEach((x) => x.hidden = x.id !== tab);
      document.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('active', x.dataset.tab === tab));
    };

    // Load teacher modules — they will find CONTENT_MANAGER already set
    import('/admin-questions.js');
    import('/admin-homework.js');

    // Auto-activate the first teacher tab after modules inject it
    const waitAndClick = () => {
      const firstTab = document.querySelector('nav button[data-tab]');
      if (firstTab) { firstTab.click(); }
      else setTimeout(waitAndClick, 80);
    };
    setTimeout(waitAndClick, 200);
  }

  // Login form handler
  $('loginForm').onsubmit = async (event) => {
    event.preventDefault();
    $('loginMessage').textContent = '';
    try {
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const body = await api('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      csrfToken = body.csrfToken;

      // Role gate: only teacher/admin can use this portal
      if (!['teacher', 'admin'].includes(body.user.role)) {
        $('loginMessage').textContent = `此账号角色为「${roleName[body.user.role] || body.user.role}」，没有教师权限。请联系管理员开通。`;
        // Log them back out since they can't use this portal
        await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
        csrfToken = '';
        return;
      }

      // Enter teacher dashboard
      enter({
        platform: false,
        username: body.user.displayName || body.user.username,
        role: body.user.role,
        systems: [
          { system_code: 'hobby', role: body.user.role },
          { system_code: 'gaokao', role: body.user.role },
        ],
      });
    } catch (error) {
      $('loginMessage').textContent = error.message;
    }
  };

  // Logout
  document.addEventListener('click', async (event) => {
    if (event.target.id !== 'logout') return;
    try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
    location.reload();
  });

  // Check existing session on load
  api('/api/admin/session').then((body) => {
    if (body.manager) enter(body.manager);
  }).catch(() => {});
})();
