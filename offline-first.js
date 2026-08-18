(() => {
  'use strict';

  const ACCOUNT_KEY = 'hetian_offline_account_v1';
  const EDUCATION_KEY = 'hetianyu_education_state_v1';
  const GAOKAO_KEY = 'hetian_gaokao_state_v1';
  const LAST_BACKUP_KEY = 'hetian_offline_last_backup_v1';
  const FORMAT = 'hetian-offline-backup';

  const read = (key) => {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
  };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const download = (name, value) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: name });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const existingName = () => read(ACCOUNT_KEY)?.name
    || read(EDUCATION_KEY)?.profile?.username
    || read(GAOKAO_KEY)?.profile?.name
    || '';
  const getAccount = () => {
    const account = read(ACCOUNT_KEY);
    if (account?.name) return account;
    const name = existingName();
    return name ? saveAccount(name) : null;
  };
  const saveAccount = (name) => {
    const previous = read(ACCOUNT_KEY) || {};
    const account = { version: 1, name: String(name || '').trim(), createdAt: previous.createdAt || Date.now(), updatedAt: Date.now() };
    if (!account.name) throw new Error('请输入姓名或昵称');
    write(ACCOUNT_KEY, account);
    navigator.storage?.persist?.().catch(() => {});
    return account;
  };
  const getProfiles = () => ({
    hobby: (() => { const p = read(EDUCATION_KEY)?.profile || {}; return { name: p.username || '', instrument: p.instrument || '吉他', age: p.age || '', dailyMinutes: p.dailyMinutes || 30 }; })(),
    gaokao: (() => { const p = read(GAOKAO_KEY)?.profile || {}; return { name: p.name || '', examDate: p.examDate || '', direction: p.direction || '', primaryMajor: p.primaryMajor || '', secondaryMajor: p.secondaryMajor || '', province: p.province || '广东省' }; })()
  });
  const saveProfile = (system, profile) => {
    if (system === 'hobby') {
      if (window.HetianEducation?.saveProfile) window.HetianEducation.saveProfile({ ...profile, username: profile.name });
      else {
        const state = read(EDUCATION_KEY) || { version: 1, profile: {}, onboarding: {} };
        state.profile = { ...state.profile, ...profile, username: profile.name, updatedAt: Date.now() };
        state.onboarding = { ...state.onboarding, completed: true };
        write(EDUCATION_KEY, state);
      }
    } else {
      if (window.GaokaoStore?.saveProfile) window.GaokaoStore.saveProfile(profile);
      else {
        const state = read(GAOKAO_KEY) || { version: 1, profile: {} };
        state.profile = { ...state.profile, ...profile, completed: true, updatedAt: Date.now() };
        write(GAOKAO_KEY, state);
      }
    }
    if (profile.name) saveAccount(profile.name);
  };
  const makeBackup = () => ({
    format: FORMAT,
    version: 1,
    createdAt: new Date().toISOString(),
    account: read(ACCOUNT_KEY),
    education: read(EDUCATION_KEY),
    gaokao: read(GAOKAO_KEY)
  });
  const restoreBackup = (backup) => {
    if (!backup || backup.format !== FORMAT || backup.version !== 1) throw new Error('这不是有效的和田玉离线备份');
    write(LAST_BACKUP_KEY, makeBackup());
    if (backup.account) write(ACCOUNT_KEY, backup.account);
    if (backup.education) write(EDUCATION_KEY, backup.education);
    if (backup.gaokao) write(GAOKAO_KEY, backup.gaokao);
  };
  window.HetianOffline = { getAccount, saveAccount, getProfiles, saveProfile, makeBackup, restoreBackup };

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const detectCloud = async () => {
    if (location.protocol === 'file:') return false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch('/api/auth/session', { credentials: 'same-origin', signal: controller.signal });
      return response.ok && (response.headers.get('content-type') || '').includes('application/json');
    } catch { return false; } finally { clearTimeout(timer); }
  };
  const field = (label, name, value = '', type = 'text', extra = '') => `<label>${label}<input name="${name}" type="${type}" value="${escapeHtml(value)}" ${extra}></label>`;

  function activateOffline() {
    const oldBar = document.querySelector('.account-bar');
    const bar = oldBar ? oldBar.cloneNode(false) : Object.assign(document.createElement('div'), { className: 'account-bar' });
    if (oldBar) oldBar.replaceWith(bar); else document.body.append(bar);
    const serverDialog = document.querySelector('.auth-dialog');
    serverDialog?.remove();
    const dialog = document.createElement('dialog');
    dialog.className = 'auth-dialog';
    document.body.append(dialog);

    const render = () => {
      const account = getAccount();
      bar.innerHTML = `<span class="account-name">${account ? `离线 · ${escapeHtml(account.name)}` : '离线优先模式'}</span><button class="quiet" data-action="profile">${account ? '本机档案' : '创建本机档案'}</button><button class="quiet" data-action="backup">数据备份</button>`;
    };
    const closeButton = '<button class="account-close" type="button" aria-label="关闭">×</button>';
    const openCreate = () => {
      dialog.innerHTML = `<form class="auth-card"><h2>创建本机档案</h2><p>无需邮箱和密码，资料与学习进度只保存在这台设备。</p>${field('姓名或昵称', 'name', existingName(), 'text', 'minlength="1" maxlength="40" required')}<div class="auth-message"></div><div class="auth-actions"><button type="button" class="cancel">取消</button><button class="submit">保存</button></div></form>`;
      dialog.querySelector('.cancel').onclick = () => dialog.close();
      dialog.querySelector('form').onsubmit = event => {
        event.preventDefault();
        try { saveAccount(event.currentTarget.elements.name.value); render(); dialog.close(); openProfiles(); }
        catch (error) { dialog.querySelector('.auth-message').textContent = error.message; }
      };
      dialog.showModal();
    };
    const openProfiles = () => {
      if (!getAccount()) return openCreate();
      const { hobby, gaokao } = getProfiles();
      dialog.innerHTML = `<div class="auth-card account-center">${closeButton}<h2>本机学习档案</h2><p>两个系统的档案独立保存，刷新或下次打开无需重新填写。</p>
        <form data-system="hobby"><h3>音乐爱好者</h3>${field('姓名', 'name', hobby.name)}${field('乐器', 'instrument', hobby.instrument)}${field('年龄', 'age', hobby.age, 'number', 'min="3" max="120"')}${field('每天学习时间（分钟）', 'dailyMinutes', hobby.dailyMinutes, 'number', 'min="5" max="480"')}<button class="submit">保存爱好者档案</button><div class="auth-message"></div></form>
        <form data-system="gaokao"><h3>高考音乐生</h3>${field('姓名', 'name', gaokao.name)}${field('考试日期', 'examDate', gaokao.examDate, 'date')}${field('未来方向', 'direction', gaokao.direction)}${field('主项', 'primaryMajor', gaokao.primaryMajor)}${field('副项', 'secondaryMajor', gaokao.secondaryMajor)}${field('考试省份', 'province', gaokao.province)}<button class="submit">保存高考档案</button><div class="auth-message"></div></form></div>`;
      dialog.querySelector('.account-close').onclick = () => dialog.close();
      dialog.querySelectorAll('form[data-system]').forEach(form => form.onsubmit = event => {
        event.preventDefault();
        const profile = Object.fromEntries(new FormData(form));
        if (profile.age) profile.age = Number(profile.age);
        if (profile.dailyMinutes) profile.dailyMinutes = Number(profile.dailyMinutes);
        saveProfile(form.dataset.system, profile);
        const message = form.querySelector('.auth-message');
        message.className = 'auth-message success'; message.textContent = '已保存在本机'; render();
      });
      dialog.showModal();
    };
    const openBackup = () => {
      dialog.innerHTML = `<div class="auth-card">${closeButton}<h2>离线数据备份</h2><p>备份包含两套个人档案、答题记录、掌握度与学习进度。导入前会在本机保留一次恢复点。</p><input type="file" accept="application/json,.json" hidden><div class="auth-message"></div><div class="auth-actions"><button class="quiet" data-import>导入备份</button><button class="submit" data-export>导出备份</button></div></div>`;
      dialog.querySelector('.account-close').onclick = () => dialog.close();
      dialog.querySelector('[data-export]').onclick = () => download(`和田玉学习数据-${new Date().toISOString().slice(0, 10)}.json`, makeBackup());
      const input = dialog.querySelector('input[type=file]');
      dialog.querySelector('[data-import]').onclick = () => input.click();
      input.onchange = async () => {
        const message = dialog.querySelector('.auth-message');
        try { restoreBackup(JSON.parse(await input.files[0].text())); message.className = 'auth-message success'; message.textContent = '导入成功，正在重新载入…'; setTimeout(() => location.reload(), 500); }
        catch (error) { message.className = 'auth-message'; message.textContent = error.message; }
      };
      dialog.showModal();
    };
    bar.onclick = event => ({ profile: openProfiles, backup: openBackup }[event.target.dataset.action]?.());
    render();
  }

  detectCloud().then(available => { if (!available) activateOffline(); });
})();
