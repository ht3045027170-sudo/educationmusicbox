(() => {
  'use strict';

  const product = window.HaitangProduct?.product || '';
  const $ = (id) => document.getElementById(id);

  if (!product) return;

  document.body.classList.add(`product-${product}`);
  document.title = product === 'exam' ? '海棠艺考 · 内测0.0.1' : '海棠音乐 · 内测0.0.1';
  window.HAITANG_PRODUCT = product;
  window.HetianSettings?.setMode?.(product === 'exam' ? 'gaokao' : 'hobby');
  const productLabel = $('settingsProductName');
  if (productLabel) productLabel.textContent = product === 'exam' ? '海棠艺考' : '海棠音乐';
  const settingsContext = $('settingsContext');
  if (settingsContext) settingsContext.textContent = product === 'exam' ? 'HAITANG EXAM · SETTINGS' : 'HAITANG MUSIC · SETTINGS';

  function showExamLogin(message = '请登录海棠艺考账号后继续。') {
    window.HetianApp?.showPage?.('gaokaoLogin');
    const status = $('gaokaoLoginStatus');
    if (status) status.textContent = window.HAITANG_OFFLINE ? '当前无法连接账号服务，请联网后再登录海棠艺考。' : message;
  }

  function syncTeacherEntry(user) {
    document.querySelectorAll('.gk-teacher-entry').forEach((entry) => {
      entry.classList.toggle('hidden', user?.role !== 'teacher');
    });
    document.querySelectorAll('.gk-student-entry').forEach((entry) => {
      entry.classList.toggle('hidden', !user || user.role === 'teacher');
    });
  }

  function enterProduct(user) {
    if (product === 'music') {
      window.HetianEducationUI?.goEducationHome?.();
      return;
    }
    syncTeacherEntry(user);
    if (!user) {
      showExamLogin();
      return;
    }
    window.GaokaoApp?.enterGaokao?.();
  }

  $('gaokaoLoginButton')?.addEventListener('click', () => window.HetianAuth?.openLogin?.());
  $('gaokaoRegisterButton')?.addEventListener('click', () => window.HetianAuth?.openRegister?.());
  window.addEventListener('hetian:auth-changed', (event) => enterProduct(event.detail?.user || null));

  if (product === 'exam') showExamLogin('正在确认登录状态…');
  window.HetianAuth?.whenReady?.().then(enterProduct);
})();
