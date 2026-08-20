(() => {
  'use strict';

  const STORAGE_KEY = 'hetian_gaokao_state_v1';
  const VERSION = 1;
  const clone = value => JSON.parse(JSON.stringify(value));
  const now = () => Date.now();
  const isoDate = value => {
    const date = value ? new Date(value) : new Date();
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  };

  function defaults() {
    return {
      version: VERSION,
      profile: {
        completed: false,
        name: '',
        examDate: '',
        targetSchool: '',
        province: '广东省',
        direction: '音乐教育',
        primarySubject: '',
        secondarySubject: '',
        createdAt: 0,
        updatedAt: 0
      },
      learning: {
        streakDays: 0,
        lastStudyDate: '',
        totalQuestions: 0,
        totalCorrect: 0,
        totalSeconds: 0
      },
      mastery: {},
      answers: [],
      mistakes: {},
      sessions: [],
      daily: {},
      settings: { obsidianVaultHint: '音乐高考知识库' }
    };
  }

  function mergeState(input) {
    const base = defaults();
    const source = input && typeof input === 'object' ? input : {};
    return {
      ...base,
      ...source,
      version: VERSION,
      profile: { ...base.profile, ...(source.profile || {}) },
      learning: { ...base.learning, ...(source.learning || {}) },
      mastery: source.mastery && typeof source.mastery === 'object' ? source.mastery : {},
      mistakes: source.mistakes && typeof source.mistakes === 'object' ? source.mistakes : {},
      answers: Array.isArray(source.answers) ? source.answers.slice(-3000) : [],
      sessions: Array.isArray(source.sessions) ? source.sessions.slice(-200) : [],
      daily: source.daily && typeof source.daily === 'object' ? source.daily : {},
      settings: { ...base.settings, ...(source.settings || {}) }
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return mergeState(raw ? JSON.parse(raw) : null);
    } catch (error) {
      console.warn('高考系统数据读取失败，已使用安全空状态。', error);
      return defaults();
    }
  }

  let state = load();

  function save() {
    state.version = VERSION;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('hetian:gaokao-state', { detail: clone(state) }));
    return clone(state);
  }

  function getState() { return clone(state); }

  function update(mutator) {
    const draft = clone(state);
    const result = mutator(draft) || draft;
    state = mergeState(result);
    return save();
  }

  function saveProfile(profile) {
    const timestamp = now();
    return update(next => {
      next.profile = {
        ...next.profile,
        ...profile,
        completed: true,
        createdAt: next.profile.createdAt || timestamp,
        updatedAt: timestamp
      };
      return next;
    });
  }

  function recordAnswer(payload) {
    const createdAt = now();
    const record = {
      id: `gk-answer-${createdAt}-${Math.random().toString(36).slice(2, 7)}`,
      questionId: payload.questionId,
      category: payload.category,
      knowledgeId: payload.knowledgeId,
      difficulty: payload.difficulty,
      userAnswer: payload.userAnswer,
      correctAnswer: payload.correctAnswer,
      correct: Boolean(payload.correct),
      responseTime: Math.max(0, Number(payload.responseTime) || 0),
      mode: payload.mode || 'theory-practice',
      createdAt
    };
    update(next => {
      next.answers.push(record);
      next.answers = next.answers.slice(-3000);
      next.learning.totalQuestions += 1;
      next.learning.totalCorrect += record.correct ? 1 : 0;
      const day = isoDate(createdAt);
      if (next.learning.lastStudyDate !== day) {
        const yesterday = isoDate(createdAt - 86400000);
        next.learning.streakDays = next.learning.lastStudyDate === yesterday ? next.learning.streakDays + 1 : 1;
        next.learning.lastStudyDate = day;
      }
      const mastery = next.mastery[record.knowledgeId] || {
        knowledgeId: record.knowledgeId,
        category: record.category,
        attempts: 0,
        correct: 0,
        recent: [],
        lastPracticedAt: 0
      };
      mastery.attempts += 1;
      mastery.correct += record.correct ? 1 : 0;
      mastery.recent.push(record.correct ? 1 : 0);
      mastery.recent = mastery.recent.slice(-20);
      mastery.accuracy = Math.round(mastery.correct / mastery.attempts * 100);
      mastery.recentAccuracy = Math.round(mastery.recent.reduce((sum, value) => sum + value, 0) / mastery.recent.length * 100);
      mastery.lastPracticedAt = createdAt;
      next.mastery[record.knowledgeId] = mastery;
      if (!record.correct) {
        const mistake = next.mistakes[record.questionId] || {
          questionId: record.questionId,
          knowledgeId: record.knowledgeId,
          category: record.category,
          wrongCount: 0,
          resolved: false
        };
        mistake.wrongCount += 1;
        mistake.userAnswer = record.userAnswer;
        mistake.correctAnswer = record.correctAnswer;
        mistake.lastWrongAt = createdAt;
        mistake.resolved = false;
        next.mistakes[record.questionId] = mistake;
      } else if (next.mistakes[record.questionId]) {
        next.mistakes[record.questionId].resolved = true;
      }
      const daily = next.daily[day] || { date: day, theoryQuestions: 0, theoryCorrect: 0, dictationQuestions: 0, dictationCorrect: 0, sightSingingCount: 0 };
      if (record.category === 'dictation') {
        daily.dictationQuestions += 1;
        daily.dictationCorrect = (daily.dictationCorrect || 0) + (record.correct ? 1 : 0);
      } else {
        daily.theoryQuestions += 1;
        daily.theoryCorrect += record.correct ? 1 : 0;
      }
      next.daily[day] = daily;
      return next;
    });
    return record;
  }

  function finishSession(session) {
    return update(next => {
      next.sessions.push({ ...session, completedAt: now() });
      next.sessions = next.sessions.slice(-200);
      return next;
    });
  }

  function accuracyFor(category) {
    const records = state.answers.filter(item => !category || item.category === category);
    if (!records.length) return null;
    return Math.round(records.filter(item => item.correct).length / records.length * 100);
  }

  function weakKnowledge(limit = 3) {
    return Object.values(state.mastery)
      .filter(item => item.attempts >= 2)
      .sort((a, b) => (a.recentAccuracy - b.recentAccuracy) || (b.attempts - a.attempts))
      .slice(0, limit);
  }

  function exportObsidianMarkdown() {
    const day = isoDate();
    const daily = state.daily[day] || {};
    const weak = weakKnowledge(5);
    const accuracy = daily.theoryQuestions ? Math.round((daily.theoryCorrect || 0) / daily.theoryQuestions * 100) : null;
    const lines = [
      '---',
      'tags: [高考音乐, 学习记录, 广东统考]',
      `date: ${day}`,
      '---',
      '',
      `# ${day} 高考音乐训练`,
      '',
      `- 学生：${state.profile.name || '未填写'}`,
      `- 方向：${state.profile.direction || '未填写'}`,
      `- 乐理：${daily.theoryQuestions || 0} 题`,
      `- 正确率：${accuracy === null ? '暂无数据' : `${accuracy}%`}`,
      `- 听写：${daily.dictationQuestions || 0} 题`,
      `- 视唱：${daily.sightSingingCount || 0} 条`,
      '',
      '## 当前薄弱知识点',
      '',
      ...(weak.length ? weak.map(item => `- ${item.knowledgeId}：${item.recentAccuracy}%`) : ['- 暂无足够数据']),
      ''
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${day}-高考音乐训练.md`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  window.GaokaoStore = {
    STORAGE_KEY,
    getState,
    update,
    saveProfile,
    profileExists: () => Boolean(state.profile.completed && state.profile.name),
    recordAnswer,
    finishSession,
    accuracyFor,
    weakKnowledge,
    exportObsidianMarkdown,
    isoDate
  };
})();
