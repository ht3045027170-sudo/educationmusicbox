(() => {
  'use strict';

  const LOCKED_PAGES = new Set(['soundLab', 'scoreEditor', 'midiStudio', 'studioOnePro']);
  // AI 视唱辅助已对手机端开放；其余专业功能仍由 LOCKED_PAGES 管理。
  const mobileSightLocked = false;
  const ADMIN_HASH_KEY = 'hetian_admin_passphrase_sha256_v1';
  const ADMIN_SESSION_KEY = 'hetian_admin_session_v1';
  let secretTapCount = 0;
  let tapTimer = 0;

  const accessDialog = document.getElementById('sightAccessDialog');
  const title = document.getElementById('sightAccessTitle');
  const text = document.getElementById('sightAccessText');
  const passwordWrap = document.getElementById('sightAdminPasswordWrap');
  const passwordInput = document.getElementById('sightAdminPassword');
  const submit = document.getElementById('sightAdminSubmit');

  function isAdmin() {
    return sessionStorage.getItem(ADMIN_SESSION_KEY) === '1';
  }

  function hasCloudAdmin() {
    return window.HetianAuth?.getUser?.()?.role === 'admin';
  }

  function hasCreatorUnlock() {
    return Boolean(window.LicenseManager?.canAccess?.('advanced_level'));
  }

  function hasProfessionalAccess() {
    return isAdmin() || hasCloudAdmin() || hasCreatorUnlock();
  }

  function syncAdminClass() {
    document.body.classList.toggle('admin-mode', hasProfessionalAccess());
  }

  function showLocked(page = '') {
    title.textContent = page === 'sightSinging' && mobileSightLocked ? '手机版视唱暂时锁定' : '专业功能暂未开放';
    text.textContent = page === 'sightSinging' && mobileSightLocked
      ? '当前手机版先专注练耳、听记与音乐理论学院。视唱识谱模块会在离线识别准确度达到要求后重新开放。'
      : '当前离线版专注练耳、音乐理论与基础工具。制谱、MIDI、音色实验室等代码仍完整保留。';
    passwordWrap.classList.add('hidden');
    submit.classList.add('hidden');
    if (accessDialog?.showModal) accessDialog.showModal();
  }

  async function hash(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(item => item.toString(16).padStart(2, '0')).join('');
  }

  function showAdminEntry() {
    const exists = Boolean(localStorage.getItem(ADMIN_HASH_KEY));
    title.textContent = exists ? '管理员模式' : '首次设置管理员口令';
    text.textContent = exists
      ? '输入本机管理员口令后，本次打开期间可访问保留的专业模块。'
      : '口令只以摘要形式保存在本机。请自行妥善记录；遗忘后只能清除本地管理员设置。';
    passwordInput.value = '';
    passwordWrap.classList.remove('hidden');
    submit.classList.remove('hidden');
    submit.textContent = exists ? '进入管理员模式' : '设置并进入';
    if (accessDialog?.showModal) accessDialog.showModal();
    setTimeout(() => passwordInput.focus(), 80);
  }

  document.addEventListener('click', event => {
    const link = event.target.closest?.('[data-page]');
    const page = link?.dataset.page;
    if (page && ((LOCKED_PAGES.has(page)) || (page === 'sightSinging' && mobileSightLocked)) && !hasProfessionalAccess()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showLocked(page);
    }
  }, true);

  document.getElementById('sightAdminMark')?.addEventListener('click', () => {
    secretTapCount += 1;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => { secretTapCount = 0; }, 2200);
    if (secretTapCount >= 7) {
      secretTapCount = 0;
      showAdminEntry();
    }
  });

  submit?.addEventListener('click', async () => {
    const value = passwordInput.value.trim();
    if (value.length < 6) {
      text.textContent = '口令至少需要 6 个字符。';
      return;
    }
    const digest = await hash(value);
    const saved = localStorage.getItem(ADMIN_HASH_KEY);
    if (!saved) {
      localStorage.setItem(ADMIN_HASH_KEY, digest);
    } else if (saved !== digest) {
      text.textContent = '口令不正确。';
      passwordInput.select();
      return;
    }
    sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
    syncAdminClass();
    accessDialog.close();
  });

  window.addEventListener('hetian:education-state', syncAdminClass);
  window.addEventListener('hetian:auth-changed', syncAdminClass);
  window.addEventListener('load', syncAdminClass, { once:true });
  window.HetianFeatureAccess = { isAdmin: hasProfessionalAccess, showLocked, sync:syncAdminClass };
  syncAdminClass();
})();
