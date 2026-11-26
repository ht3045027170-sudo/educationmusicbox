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

  function syncTeacherEntry(user) {
    const canTeach = ['teacher', 'admin'].includes(user?.role);
    document.querySelectorAll('.gk-teacher-entry').forEach((entry) => {
      entry.classList.toggle('hidden', !canTeach);
    });
    document.querySelectorAll('.gk-student-entry').forEach((entry) => {
      entry.classList.toggle('hidden', !user || canTeach);
    });
  }

  function enterProduct(user) {
    if (product === 'music') {
      window.HetianEducationUI?.goEducationHome?.();
      return;
    }
    syncTeacherEntry(user);
    const current = window.HetianApp?.getCurrentPage?.();
    if (user && current === 'gkTools') window.GaokaoApp?.enterGaokao?.();
    if (!user && (current === 'gaokaoStudentClass' || current === 'gaokaoTeacher')) {
      window.HetianApp?.showPage?.('gkTools');
    }
  }

  if (product === 'exam') window.HetianApp?.showPage?.('gkTools');
  else enterProduct(null);
  window.addEventListener('hetian:auth-changed', (event) => enterProduct(event.detail?.user || null));
  window.HetianAuth?.whenReady?.().then(user => {
    if (product === 'exam') enterProduct(user);
  });
})();
