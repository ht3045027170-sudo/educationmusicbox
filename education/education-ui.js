(() => {
  'use strict';

  const Education = window.HetianEducation;
  const App = window.HetianApp;
  if (!Education || !App) return;

  const $ = id => document.getElementById(id);
  const form = $('eduProfileForm');
  const nicknameInput = $('eduNickname');
  const totalSteps = 4;
  let step = 1;
  let toastTimer = 0;

  // Some packaged WebViews can keep focus on the page-change button after the
  // onboarding page is revealed. Re-assert focus from the user's real tap so
  // both the Windows caret and Android soft keyboard are available.
  if (nicknameInput) {
    const activateNickname = () => {
      nicknameInput.disabled = false;
      nicknameInput.readOnly = false;
      nicknameInput.style.pointerEvents = 'auto';
      nicknameInput.focus({ preventScroll: true });
    };
    nicknameInput.addEventListener('pointerup', activateNickname);
    nicknameInput.addEventListener('click', activateNickname);
  }

  function showToast(message, error = false) {
    const toast = $('eduToast');
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.toggle('error', error);
    toast.classList.add('show');
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function selectedValues(name) {
    return [...form.querySelectorAll(`[name="${name}"]:checked`)].map(input => input.value);
  }

  function fillForm(state) {
    const profile = state.profile;
    form.elements.nickname.value = profile.username || '';
    form.elements.instrument.value = profile.primaryMajor || '';
    form.elements.age.value = profile.age || '';
    const minute = String(profile.dailyMinutes || 20);
    const minuteInput = form.querySelector(`[name="dailyMinutes"][value="${minute}"]`);
    if (minuteInput) minuteInput.checked = true;
  }

  function setStep(nextStep) {
    step = Math.max(1, Math.min(totalSteps, nextStep));
    form.querySelectorAll('.edu-step').forEach(section => {
      section.classList.toggle('active', Number(section.dataset.step) === step);
    });
    document.querySelectorAll('.edu-step-indicator').forEach(indicator => {
      const index = Number(indicator.dataset.step);
      indicator.classList.toggle('active', index === step);
      indicator.classList.toggle('done', index < step);
      indicator.querySelector('i').textContent = index < step ? '✓' : String(index);
    });
    $('eduProgressBar').style.width = `${step / totalSteps * 100}%`;
    $('eduProgressText').textContent = `${step} / ${totalSteps}`;
    $('eduPrevStep').hidden = step === 1;
    $('eduNextStep').textContent = step === totalSteps ? '完成建档' : '继续';
    $('eduFormError').textContent = '';
    const heading = form.querySelector(`.edu-step[data-step="${step}"] h2`);
    if (heading && step !== 1) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
    Education.updateState(state => {
      state.onboarding.currentStep = step;
      return state;
    });
  }

  function validateStep() {
    let message = '';
    if (step === 1) {
      if (!form.elements.nickname.value.trim()) message = '请填写希望我们怎样称呼你。';
    } else if (step === 2 && !form.elements.instrument.value) {
      message = '请选择当前主要学习的乐器。';
    } else if (step === 3) {
      const age = Number(form.elements.age.value);
      if (!Number.isInteger(age) || age < 5 || age > 100) message = '请输入 5—100 之间的有效年龄。';
    } else if (step === 4 && !form.elements.dailyMinutes.value) {
      message = '请选择每天适合的训练时长。';
    }
    $('eduFormError').textContent = message;
    return !message;
  }

  function saveProfile() {
    if (!validateStep()) return;
    const profile = {
      username: form.elements.nickname.value.trim(),
      age: Number(form.elements.age.value),
      grade: '',
      examDirection: ['音乐爱好者'],
      primaryMajor: form.elements.instrument.value,
      dailyMinutes: Number(form.elements.dailyMinutes.value),
      examDate: '',
      selfReportedWeaknesses: []
    };
    Education.saveProfile(profile);
    // 立即从统一状态读取一次，避免旧版 WebView 在表单切页时出现“看似提交、实际未保存”的假象。
    const saved = Education.getState();
    if (!saved.profile.username || !saved.onboarding.completed) {
      showToast('档案暂未保存，请检查浏览器是否允许本地存储。', true);
      return;
    }
    renderDashboard();
    App.showPage('eduDashboard');
    showToast('学习档案已保存；下次打开将直接进入学习首页。');
  }

  function greeting() {
    const hour = new Date().getHours();
    if (hour < 6) return '夜深了';
    if (hour < 11) return '早上好';
    if (hour < 14) return '中午好';
    if (hour < 18) return '下午好';
    return '晚上好';
  }

  function examCountdown(examDate) {
    if (!examDate) return null;
    const target = new Date(`${examDate}T00:00:00`);
    if (Number.isNaN(target.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - today.getTime()) / 86400000);
  }

  function formatDuration(seconds) {
    const minutes = Math.round((Number(seconds) || 0) / 60);
    if (minutes < 60) return `${minutes}`;
    return `${Math.floor(minutes / 60)}.${String(minutes % 60).padStart(2, '0')}`;
  }

  function currentWeakness(state) {
    const records = Object.values(state.theoryMastery || {})
      .filter(record => String(record.knowledgeId || '').startsWith('guitar.'));
    const measured = records
      .filter(record => record.attempts >= 3)
      .sort((a, b) => a.accuracy - b.accuracy)[0];
    if (measured) return `${labelForKnowledge(measured.knowledgeId)} · ${Math.round(measured.accuracy * 100)}%`;
    return '等待吉他乐理训练数据';
  }

  function labelForKnowledge(id) {
    const labels = {
      'ear.interval.minor_second': '小二度',
      'ear.interval.major_second': '大二度',
      'ear.interval.minor_third': '小三度',
      'ear.interval.major_third': '大三度',
      'ear.interval.perfect_fourth': '纯四度',
      'ear.interval.tritone': '三全音',
      'ear.interval.perfect_fifth': '纯五度',
      'ear.interval.minor_sixth': '小六度',
      'ear.interval.major_sixth': '大六度',
      'ear.interval.minor_seventh': '小七度',
      'ear.interval.major_seventh': '大七度',
      'ear.interval.octave': '纯八度'
    };
    return labels[id] || String(id || '').split('.').at(-1) || '暂无';
  }

  function planRows(state) {
    const minutes = state.profile.dailyMinutes || 20;
    return [
      { title: '六线谱与指板', subtitle: '建立琴弦、品位和音高的对应', minutes: Math.max(3, Math.round(minutes * .35)) },
      { title: '节奏与拍号', subtitle: '理解常用音符、休止符和小节', minutes: Math.max(3, Math.round(minutes * .3)) },
      { title: '和弦构成', subtitle: '把公式、组成音与常用按法连起来', minutes: Math.max(3, Math.round(minutes * .35)) }
    ];
  }

  function renderDashboard() {
    window.HetianLearningFlow?.ensureDailyPlan?.();
    const state = Education.getState();
    if (!Education.profileExists()) return;
    const learning = state.learning;
    const totalAccuracy = learning.totalQuestions
      ? Math.round(learning.totalCorrect / learning.totalQuestions * 100)
      : 0;
    const rows = planRows(state);

    $('eduGreeting').textContent = `${greeting()}，${state.profile.username}`;
    $('eduEncouragement').textContent = learning.totalQuestions
      ? '你的每一次回答，都在让下一步训练更准确。'
      : '今天从吉他本身开始，把谱面、指板与声音连起来。';
    $('eduCountdownNumber').textContent = state.profile.primaryMajor || '—';
    $('eduCountdownLabel').textContent = state.profile.age ? `${state.profile.age} 岁 · 学习乐器` : '学习乐器';
    $('eduTodayMinutes').textContent = `${state.profile.dailyMinutes || 20} 分钟`;
    $('eduPlanList').innerHTML = rows.map((task, index) => `
      <div class="edu-plan-row">
        <i>${index + 1}</i>
        <span><b>${task.title}</b><small>${task.subtitle || task.reason || ''}</small></span>
        <span>${task.minutes || Math.max(2, Math.round((state.profile.dailyMinutes || 20) / rows.length))} 分</span>
      </div>
    `).join('');
    $('eduStreak').textContent = String(learning.streakDays || 0);
    $('eduTotalQuestions').textContent = String(learning.totalQuestions || 0);
    $('eduAccuracy').textContent = `${totalAccuracy}%`;
    $('eduStudyTime').textContent = formatDuration(learning.totalStudySeconds);
    $('eduWeaknessText').textContent = currentWeakness(state);
    $('eduInsightText').textContent = learning.totalQuestions
      ? `已记录 ${learning.totalQuestions} 道题；继续训练后，这里会显示具体知识点与常见混淆项。`
      : '目前只有自评信息，还没有足够的答题数据。系统不会用假分数填充学习报告。';
  }

  function renderSettings() {
    const state = Education.getState();
    const profile = state.profile;
    $('eduSettingsProfile').innerHTML = [
      ['姓名', profile.username || '未设置'],
      ['学习乐器', profile.primaryMajor || '未设置'],
      ['年龄', profile.age ? `${profile.age} 岁` : '未设置'],
      ['每日训练', `${profile.dailyMinutes || 20} 分钟`]
    ].map(([term, value]) => `<dt>${term}</dt><dd>${value}</dd>`).join('');
    const license = window.LicenseManager?.getLicense?.() || state.license || {};
    $('eduUnlockStatus').textContent = window.LicenseManager?.canAccess?.('advanced_level')
      ? `当前权限：${window.LicenseManager.label()} · 所有关卡、MIDI、制谱、AI 与报告功能已解锁。`
      : `当前权限：免费版 · 基础工具与游客模式可用；教师题库与云同步权限需后续激活。`;
    $('eduRedeemCode').value = '';
    $('eduRedeemMessage').textContent = '';
    $('eduRedeemMessage').className = 'settings-message';
  }

  function openSettings() {
    renderSettings();
    App.showPage('eduSettings');
  }

  function clearLearningRecords() {
    const phrase = window.prompt('将清除答题记录、掌握度和关卡成绩，但保留学习档案与已兑换权限。请输入“确认清除”继续。');
    if (phrase !== '确认清除') return;
    Education.updateState(state => {
      state.learning = { ...state.learning, xp:0, jadePoints:0, streakDays:0, lastStudyDate:'', totalStudySeconds:0, totalQuestions:0, totalCorrect:0, bestCombo:0, currentCombo:0 };
      state.mastery = {}; state.theoryMastery = {}; state.answerEvents = []; state.theoryAnswerEvents = []; state.theoryProgress = {}; state.levelProgress = {}; state.dailyPlans = {}; state.sessions = [];
      return state;
    });
    const cleared = Education.getState();
    if (cleared.answerEvents.length || cleared.sessions.length || Object.keys(cleared.mastery).length) {
      showToast('清除未能完整保存，请检查浏览器本地存储权限。', true);
      return;
    }
    renderSettings();
    showToast('学习记录已清除，学习档案和兑换权限已保留。');
  }

  function resetHobbyData() {
    const phrase = window.prompt('将清除爱好者档案、训练记录、关卡进度和设置，但不会删除高考音乐生档案，也不会删除制谱、MIDI 或自制题库。请输入“确认删除”继续。');
    if (phrase !== '确认删除') return;
    Education.resetEducationState();
    const reset = Education.getState();
    if (Education.profileExists() || reset.answerEvents.length || reset.sessions.length) {
      showToast('数据未能完整重置，请检查浏览器本地存储权限。', true);
      return;
    }
    fillForm(reset);
    App.showPage('home');
    showToast('音乐爱好者档案与学习数据已清除，高考档案不受影响。');
  }

  function redeemCode() {
    const code = $('eduRedeemCode').value.trim();
    const message = $('eduRedeemMessage');
    message.className = 'settings-message';
    const result = window.LicenseManager?.toggleTestCode?.(code);
    if (!result?.ok) { message.textContent = '兑换码错误，请重新输入。'; message.classList.add('error'); return; }
    renderDashboard();
    renderSettings();
    $('eduRedeemMessage').textContent = result.active
      ? '兑换成功！开发者测试权限已开启，所有功能已解锁；再次输入可关闭。'
      : '开发者测试权限已关闭，专业功能与高级关卡已重新锁定。';
  }

  function openOnboarding(edit = false) {
    fillForm(Education.getState());
    App.showPage('eduOnboarding');
    setStep(edit ? 1 : Education.getState().onboarding.currentStep || 1);
    if (step === 1) {
      requestAnimationFrame(() => {
        const nickname = $('eduNickname');
        if (nickname) {
          nickname.disabled = false;
          nickname.readOnly = false;
          nickname.style.pointerEvents = 'auto';
          nickname.focus({ preventScroll: true });
        }
      });
    }
  }

  function goEducationHome() {
    window.HetianSettings?.setMode?.('hobby');
    if (Education.profileExists()) {
      renderDashboard();
      App.showPage('eduDashboard');
    } else {
      App.showPage('home');
    }
  }

  $('eduCreateProfile').addEventListener('click', () => openOnboarding(false));
  $('eduGuestEntry').addEventListener('click', () => App.showPage('menu'));
  $('eduWelcomeSwitchGaokao').addEventListener('click', () => window.GaokaoApp?.enterGaokao?.());
  $('eduWelcomeGuitar')?.addEventListener('click', () => window.GuitarAcademy?.open?.());
  $('eduOnboardingClose').addEventListener('click', goEducationHome);
  $('eduPrevStep').addEventListener('click', () => setStep(step - 1));
  $('eduNextStep').addEventListener('click', () => {
    if (!validateStep()) return;
    if (step < totalSteps) setStep(step + 1);
    else saveProfile();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (step === totalSteps) saveProfile();
  });

  document.addEventListener('click', event => {
    const homeBtn = event.target.closest('[data-education-home]');
    if (!homeBtn) return;
    // 工具箱返回：回到当前模式的首页（学习首页 / 高考训练首页），不再回退到模式选择页
    if (App.getCurrentPage() === 'menu' && window.HetianSettings?.getMode?.() === 'gaokao') {
      window.GaokaoApp?.openDashboard?.();
      return;
    }
    goEducationHome();
  });

  $('eduOpenToolbox').addEventListener('click', () => App.showPage('menu'));
  $('eduSwitchGaokao').addEventListener('click', () => window.GaokaoApp?.enterGaokao?.());
  $('eduOpenSettings').addEventListener('click', openSettings);
  $('eduSettingsBack').addEventListener('click', () => {
    if (window.HetianSettings?.getMode?.() === 'gaokao' && window.GaokaoApp?.openDashboard) window.GaokaoApp.openDashboard();
    else goEducationHome();
  });
  $('eduSettingsEditProfile').addEventListener('click', () => openOnboarding(true));
  $('eduSettingsExport').addEventListener('click', () => { Education.exportEducationState(); showToast('学习数据备份已导出。'); });
  $('eduSettingsImport').addEventListener('click', () => $('eduSettingsImportFile').click());
  $('eduSettingsImportFile').addEventListener('change', async event => { const file = event.target.files?.[0]; if (!file) return; try { await Education.importEducationState(file); renderSettings(); renderDashboard(); showToast('学习数据已导入。'); } catch (error) { showToast(error.message || '导入失败。', true); } finally { event.target.value = ''; } });
  $('eduSettingsClearRecords').addEventListener('click', clearLearningRecords);
  $('eduSettingsReset').addEventListener('click', resetHobbyData);
  $('eduRedeemButton').addEventListener('click', redeemCode);
  $('eduRedeemCode').addEventListener('keydown', event => { if (event.key === 'Enter') redeemCode(); });
  $('eduToolboxCardButton').addEventListener('click', () => App.showPage('menu'));
  $('eduEditProfile').addEventListener('click', () => openOnboarding(true));
  const openGuitar = () => window.GuitarAcademy?.open?.();
  $('eduStartToday').addEventListener('click', openGuitar);
  $('eduOpenMap')?.addEventListener('click', () => window.GuitarAcademy?.openMap?.());
  $('eduOpenGuitar')?.addEventListener('click', openGuitar);
  $('eduSpecialGuitar')?.addEventListener('click', openGuitar);
  $('eduExportData').addEventListener('click', () => {
    Education.exportEducationState();
    showToast('学习数据备份已导出。');
  });
  $('eduImportData').addEventListener('click', () => $('eduImportFile').click());
  $('eduImportFile').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await Education.importEducationState(file);
      renderDashboard();
      goEducationHome();
      showToast('学习数据已导入。');
    } catch (error) {
      showToast(error.message || '导入失败。', true);
    } finally {
      event.target.value = '';
    }
  });
  $('eduResetData').addEventListener('click', resetHobbyData);

  window.addEventListener('hetian:education-state', event => {
    const reduced = Boolean(event.detail?.settings?.reducedAnimation);
    document.body.classList.toggle('edu-reduced-motion', reduced);
  });

  window.HetianEducationUI = {
    renderDashboard,
    goEducationHome,
    showToast,
    labelForKnowledge,
    openSettings
  };
  App.handleBack = () => {
    const current = App.getCurrentPage();
    if (current === 'modeSelect') return false;
    if (current === 'home' || current === 'eduDashboard') { App.showPage('modeSelect'); return true; }
    if (current === 'eduSettings') { goEducationHome(); return true; }
    if (current === 'theoryAcademy') {
      renderDashboard();
      App.showPage('eduDashboard');
      return true;
    }
    if (current === 'eduChallenge') {
      window.HetianLearningFlow?.openMap?.();
      return true;
    }
    if (current === 'eduMap' || current === 'eduAssessment') {
      renderDashboard();
      App.showPage('eduDashboard');
      return true;
    }
    if (current === 'eduOnboarding') {
      goEducationHome();
      return true;
    }
    if (current === 'menu') {
      if (window.HetianSettings?.getMode?.() === 'gaokao') {
        window.GaokaoApp?.openDashboard?.();
      } else {
        goEducationHome();
      }
      return true;
    }
    App.showPage('menu');
    return true;
  };

  fillForm(Education.getState());
  if (Education.profileExists()) renderDashboard();
  App.showPage('modeSelect');
})();
