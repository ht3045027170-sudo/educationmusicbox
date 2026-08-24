(() => {
  'use strict';

  const APP_STATE_VERSION = 1;
  const STORAGE_KEY = 'hetianyu_education_state_v1';
  const LEGACY_KEYS = [
    'hetianyu_education_state',
    'hetianyuEducationState',
    'musicEducationProfileV1'
  ];
  const CoreStorage = window.HetianCore?.storage;

  const clone = value => JSON.parse(JSON.stringify(value));
  const now = () => Date.now();
  const isoDate = (value = new Date()) => {
    const date = value instanceof Date ? value : new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const uid = prefix => `${prefix}-${now()}-${Math.random().toString(36).slice(2, 9)}`;

  function defaultEducationState() {
    const createdAt = now();
    return {
      version: APP_STATE_VERSION,
      profile: {
        id: '',
        username: '',
        age: 0,
        grade: '',
        province: '',
        examDirection: [],
        primaryMajor: '',
        secondaryMajor: '',
        musicStudyYears: 0,
        theoryExperience: '',
        earTrainingExperience: '',
        dailyMinutes: 20,
        weeklyDays: 5,
        examDate: '',
        selfReportedWeaknesses: [],
        createdAt: 0,
        updatedAt: 0
      },
      onboarding: {
        completed: false,
        assessmentCompleted: false,
        currentStep: 1
      },
      learning: {
        level: 1,
        xp: 0,
        jadePoints: 0,
        streakDays: 0,
        lastStudyDate: '',
        totalStudySeconds: 0,
        totalQuestions: 0,
        totalCorrect: 0,
        bestCombo: 0,
        currentCombo: 0
      },
      mastery: {},
      theoryMastery: {},
      theoryAnswerEvents: [],
      theoryProgress: {},
      unlockState: {
        allLevels: false,
        creatorTest: false,
        teacherQuestionBank: false,
        cloudSync: false,
        activatedCode: '',
        activatedAt: 0
      },
      license: {
        type: 'free',
        status: 'active',
        expireDate: '',
        features: ['basic_tools', 'guest_mode', 'ear_basic'],
        activatedCode: '',
        activatedAt: 0
      },
      answerEvents: [],
      sessions: [],
      dailyPlans: {},
      levelProgress: {},
      assessment: {
        status: 'not-started',
        startedAt: 0,
        completedAt: 0,
        currentIndex: 0,
        answers: [],
        summary: null
      },
      achievements: [],
      settings: {
        soundEnabled: true,
        encouragementEnabled: true,
        reducedAnimation: false
      },
      meta: {
        createdAt,
        updatedAt: createdAt,
        migratedFrom: '',
        lastExportedAt: 0
      }
    };
  }

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function mergeKnown(base, incoming) {
    if (Array.isArray(base)) return Array.isArray(incoming) ? clone(incoming) : clone(base);
    if (!isPlainObject(base)) return incoming === undefined ? base : incoming;
    const output = {};
    Object.keys(base).forEach(key => {
      output[key] = isPlainObject(base[key])
        ? mergeKnown(base[key], isPlainObject(incoming?.[key]) ? incoming[key] : {})
        : Array.isArray(base[key])
          ? (Array.isArray(incoming?.[key]) ? clone(incoming[key]) : clone(base[key]))
          : (incoming?.[key] === undefined ? base[key] : incoming[key]);
    });
    if (isPlainObject(incoming)) {
      Object.keys(incoming).forEach(key => {
        if (!(key in output)) output[key] = clone(incoming[key]);
      });
    }
    return output;
  }

  function normalizeState(input) {
    const state = mergeKnown(defaultEducationState(), isPlainObject(input) ? input : {});
    state.version = APP_STATE_VERSION;
    state.profile.examDirection = [...new Set(state.profile.examDirection.filter(Boolean).map(String))];
    state.profile.selfReportedWeaknesses = [
      ...new Set(state.profile.selfReportedWeaknesses.filter(Boolean).map(String))
    ];
    state.profile.dailyMinutes = Math.max(5, Math.min(180, Number(state.profile.dailyMinutes) || 20));
    state.profile.age = Math.max(0, Math.min(100, Number(state.profile.age) || 0));
    state.profile.weeklyDays = Math.max(1, Math.min(7, Number(state.profile.weeklyDays) || 5));
    state.answerEvents = Array.isArray(state.answerEvents) ? state.answerEvents.slice(-3000) : [];
    state.theoryAnswerEvents = Array.isArray(state.theoryAnswerEvents)
      ? state.theoryAnswerEvents.slice(-3000) : [];
    state.theoryMastery = isPlainObject(state.theoryMastery) ? state.theoryMastery : {};
    state.theoryProgress = isPlainObject(state.theoryProgress) ? state.theoryProgress : {};
    state.unlockState = isPlainObject(state.unlockState) ? state.unlockState : defaultEducationState().unlockState;
    state.license = isPlainObject(state.license) ? state.license : defaultEducationState().license;
    state.license.type = String(state.license.type || 'free');
    state.license.status = String(state.license.status || 'active');
    state.license.features = Array.isArray(state.license.features) ? [...new Set(state.license.features.map(String))] : [];
    // 兼容此前的创作者测试状态：旧数据升级为正式的 developer 授权记录。
    if (state.unlockState.allLevels && state.unlockState.creatorTest && state.license.type === 'free') {
      state.license = {
        type: 'developer', status: 'active', expireDate: '', features: ['*'],
        activatedCode: state.unlockState.activatedCode || '200791', activatedAt: state.unlockState.activatedAt || now()
      };
    }
    state.sessions = Array.isArray(state.sessions) ? state.sessions.slice(-365) : [];
    state.meta.updatedAt = now();
    return state;
  }

  function migrateEducationState(input, sourceKey = STORAGE_KEY) {
    if (!isPlainObject(input)) return defaultEducationState();
    const migrated = clone(input);

    if (!migrated.version) {
      if (migrated.nickname && !migrated.profile) {
        migrated.profile = {
          username: migrated.nickname,
          grade: migrated.stage || '',
          examDirection: migrated.directions || [],
          primaryMajor: migrated.major || '',
          dailyMinutes: migrated.dailyMinutes || 20,
          examDate: migrated.examDate || '',
          selfReportedWeaknesses: migrated.weaknesses || []
        };
      }
      migrated.version = 1;
    }

    const state = normalizeState(migrated);
    if (sourceKey !== STORAGE_KEY) state.meta.migratedFrom = sourceKey;
    return state;
  }

  function readJson(key) {
    const raw = CoreStorage ? CoreStorage.readRaw(key) : localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      try {
        if (CoreStorage) CoreStorage.writeRaw(`${key}:corrupt:${now()}`, raw);
        else localStorage.setItem(`${key}:corrupt:${now()}`, raw);
      } catch (_) {}
      return null;
    }
  }

  function saveEducationState(value) {
    const state = normalizeState(value);
    if (CoreStorage) CoreStorage.writeRaw(STORAGE_KEY, JSON.stringify(state));
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('hetian:education-state', { detail: clone(state) }));
    return state;
  }

  function loadEducationState() {
    let sourceKey = STORAGE_KEY;
    let stored = readJson(STORAGE_KEY);
    if (!stored) {
      for (const key of LEGACY_KEYS) {
        stored = readJson(key);
        if (stored) {
          sourceKey = key;
          break;
        }
      }
    }
    const state = migrateEducationState(stored || defaultEducationState(), sourceKey);
    try {
      if (CoreStorage) CoreStorage.writeRaw(STORAGE_KEY, JSON.stringify(state));
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {}
    return state;
  }

  CoreStorage?.register({
    namespace: 'education', key: STORAGE_KEY, defaults: defaultEducationState(),
    migrate: value => migrateEducationState(value, STORAGE_KEY)
  });
  let currentState = loadEducationState();

  function getState() {
    return clone(currentState);
  }

  function updateState(mutator) {
    const draft = clone(currentState);
    const returned = typeof mutator === 'function' ? mutator(draft) : draft;
    currentState = saveEducationState(returned || draft);
    return getState();
  }

  function saveProfile(profile) {
    return updateState(state => {
      const timestamp = now();
      const existingCreatedAt = state.profile.createdAt || timestamp;
      state.profile = {
        ...state.profile,
        ...clone(profile),
        id: state.profile.id || uid('student'),
        createdAt: existingCreatedAt,
        updatedAt: timestamp
      };
      state.onboarding.completed = true;
      state.onboarding.currentStep = 1;
      return state;
    });
  }

  function resetEducationState(options = {}) {
    const previous = currentState;
    const next = defaultEducationState();
    if (options.preserveProfile && previous.profile.id) {
      next.profile = clone(previous.profile);
      next.onboarding.completed = previous.onboarding.completed;
    }
    currentState = saveEducationState(next);
    return getState();
  }

  function validateImportedState(value) {
    if (!isPlainObject(value)) throw new Error('备份内容不是有效的学习数据对象。');
    if (!value.profile && !value.learning && !value.version) {
      throw new Error('没有识别到海棠音乐学习数据结构。');
    }
    return migrateEducationState(value, 'import');
  }

  async function importEducationState(input) {
    let value = input;
    if (input instanceof File || input instanceof Blob) value = await input.text();
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch (_) {
        throw new Error('JSON 文件无法解析，请确认选择的是学习数据备份。');
      }
    }
    currentState = saveEducationState(validateImportedState(value));
    return getState();
  }

  function exportEducationState() {
    currentState = updateState(state => {
      state.meta.lastExportedAt = now();
      return state;
    });
    const safeName = (currentState.profile.username || '访客').replace(/[\\/:*?"<>|]/g, '_');
    const blob = new Blob([JSON.stringify(currentState, null, 2)], {
      type: 'application/json;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hetianyu-learning-backup-${safeName}-${isoDate()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function profileExists() {
    return Boolean(currentState.onboarding.completed && currentState.profile.id && currentState.profile.username);
  }

  function questionKnowledgeIds(question) {
    if (!question) return [];
    const category = String(question.category || '');
    const answer = String(question.answer || '');
    const maps = {
      interval: {
        小二度: 'ear.interval.minor_second',
        大二度: 'ear.interval.major_second',
        小三度: 'ear.interval.minor_third',
        大三度: 'ear.interval.major_third',
        纯四度: 'ear.interval.perfect_fourth',
        增四度: 'ear.interval.tritone',
        减五度: 'ear.interval.tritone',
        纯五度: 'ear.interval.perfect_fifth',
        小六度: 'ear.interval.minor_sixth',
        大六度: 'ear.interval.major_sixth',
        小七度: 'ear.interval.minor_seventh',
        大七度: 'ear.interval.major_seventh',
        纯八度: 'ear.interval.octave'
      },
      chord: {
        大三和弦: 'ear.chord.major_triad',
        小三和弦: 'ear.chord.minor_triad',
        增三和弦: 'ear.chord.augmented_triad',
        减三和弦: 'ear.chord.diminished_triad'
      }
    };
    if (maps[category]?.[answer]) return [maps[category][answer]];
    if (category === 'single') return ['ear.single.sequence'];
    if (category === 'melody') return ['ear.melody.pattern'];
    if (category === 'rhythm') return ['ear.rhythm.pattern'];
    return category ? [`ear.${category}.general`] : [];
  }

  function statusForMastery(record) {
    if (record.attempts < 5) return 'new';
    if (record.consecutiveWrong >= 3 || record.recentAccuracy < 0.5) return 'weak';
    if (record.attempts >= 20 && record.recentAccuracy >= 0.92 && record.averageResponseMs <= 4000) {
      return 'excellent';
    }
    if (record.attempts >= 20 && record.recentAccuracy >= 0.85) return 'mastered';
    if (record.masteryScore >= 65) return 'review';
    return 'learning';
  }

  function updateMasteryRecord(record, event) {
    const base = {
      knowledgeId: event.knowledgeIds[0] || '',
      attempts: 0,
      correct: 0,
      accuracy: 0,
      recentAccuracy: 0,
      averageResponseMs: 0,
      replayCount: 0,
      skipCount: 0,
      masteryScore: 0,
      level: 'new',
      lastPracticedAt: 0,
      nextReviewAt: 0,
      consecutiveCorrect: 0,
      consecutiveWrong: 0,
      commonMistakes: {},
      history: []
    };
    const next = { ...base, ...(record || {}) };
    next.attempts += 1;
    next.correct += event.isCorrect ? 1 : 0;
    next.accuracy = next.correct / next.attempts;
    next.replayCount += event.replayCount || 0;
    next.skipCount += event.skipped ? 1 : 0;
    next.consecutiveCorrect = event.isCorrect ? next.consecutiveCorrect + 1 : 0;
    next.consecutiveWrong = event.isCorrect ? 0 : next.consecutiveWrong + 1;
    if (!event.isCorrect && event.userAnswer) {
      next.commonMistakes[event.userAnswer] = (next.commonMistakes[event.userAnswer] || 0) + 1;
    }
    next.history = [
      ...next.history,
      {
        at: event.createdAt,
        correct: event.isCorrect,
        responseMs: event.responseMs,
        replayCount: event.replayCount,
        userAnswer: event.userAnswer
      }
    ].slice(-30);
    const recent = next.history.slice(-20);
    next.recentAccuracy = recent.filter(item => item.correct).length / recent.length;
    next.averageResponseMs = Math.round(
      recent.reduce((sum, item) => sum + Math.max(0, item.responseMs || 0), 0) / recent.length
    );
    const accuracyScore = next.recentAccuracy * 70;
    const speedScore = Math.max(0, Math.min(20, 20 - Math.max(0, next.averageResponseMs - 2500) / 375));
    const stabilityScore = Math.min(10, next.consecutiveCorrect * 2);
    const replayPenalty = Math.min(6, next.replayCount / Math.max(1, next.attempts));
    next.masteryScore = Math.round(Math.max(0, Math.min(100,
      accuracyScore + speedScore + stabilityScore - replayPenalty
    )));
    next.lastPracticedAt = event.createdAt;
    next.nextReviewAt = event.createdAt + (
      next.masteryScore >= 85 ? 7 : next.masteryScore >= 65 ? 3 : 1
    ) * 86400000;
    next.level = statusForMastery(next);
    return next;
  }

  function markQuestionShown(question) {
    if (!question || typeof question !== 'object') return;
    question._educationQuestionId = question._educationQuestionId || uid('question');
    if (question._educationStartedAt) return;
    question._educationStartedAt = now();
    question._educationReplayCount = 0;
  }

  function markReplay(question) {
    if (!question || typeof question !== 'object') return;
    markQuestionShown(question);
    question._educationReplayCount += 1;
  }

  function recordAnswer(payload) {
    if (!profileExists()) return null;
    const question = payload.question || {};
    markQuestionShown(question);
    const createdAt = now();
    const knowledgeIds = payload.knowledgeIds?.length
      ? payload.knowledgeIds
      : questionKnowledgeIds(question);
    const event = {
      id: uid('answer'),
      sessionId: payload.sessionId || '',
      questionId: question.id || question._educationQuestionId || payload.questionId || uid('question'),
      category: question.category || payload.category || 'unknown',
      knowledgeIds,
      difficulty: Number(payload.difficulty || question.difficulty || 1),
      correctAnswer: String(payload.correctAnswer ?? question.answer ?? ''),
      userAnswer: String(payload.userAnswer ?? ''),
      isCorrect: Boolean(payload.isCorrect),
      responseMs: Math.max(0, createdAt - Number(question._educationStartedAt || createdAt)),
      replayCount: Math.max(0, Number(question._educationReplayCount || 0) - 1),
      skipped: Boolean(payload.skipped),
      source: payload.source || question._educationSource || 'free-practice',
      levelId: payload.levelId || question._educationLevelId || '',
      createdAt
    };

    updateState(state => {
      state.answerEvents.push(event);
      state.answerEvents = state.answerEvents.slice(-3000);
      state.learning.totalQuestions += 1;
      state.learning.totalCorrect += event.isCorrect ? 1 : 0;
      state.learning.currentCombo = event.isCorrect ? state.learning.currentCombo + 1 : 0;
      state.learning.bestCombo = Math.max(state.learning.bestCombo, state.learning.currentCombo);
      state.learning.xp += event.isCorrect ? 3 : 1;
      state.learning.level = Math.max(1, Math.floor(state.learning.xp / 100) + 1);
      const today = isoDate(event.createdAt);
      if (state.learning.lastStudyDate !== today) {
        const previous = state.learning.lastStudyDate
          ? new Date(`${state.learning.lastStudyDate}T00:00:00`)
          : null;
        const current = new Date(`${today}T00:00:00`);
        const gapDays = previous && !Number.isNaN(previous.getTime())
          ? Math.round((current - previous) / 86400000)
          : 0;
        state.learning.streakDays = gapDays === 1 ? state.learning.streakDays + 1 : 1;
        state.learning.lastStudyDate = today;
      }
      knowledgeIds.forEach(knowledgeId => {
        const eventForKnowledge = { ...event, knowledgeIds: [knowledgeId] };
        state.mastery[knowledgeId] = updateMasteryRecord(
          state.mastery[knowledgeId],
          eventForKnowledge
        );
      });
      return state;
    });
    return event;
  }

  function recordTheoryAnswer(payload = {}) {
    const question = payload.question || {};
    const knowledgeId = String(payload.knowledgeId || question.knowledgeId || 'theory.general');
    const event = recordAnswer({
      question: {
        ...question,
        id: question.id || payload.questionId,
        category: payload.category || question.category || 'theory',
        difficulty: payload.difficulty || question.difficulty || 1,
        answer: payload.correctAnswer ?? question.answer
      },
      knowledgeIds: [knowledgeId],
      userAnswer: payload.userAnswer,
      correctAnswer: payload.correctAnswer ?? question.answer,
      isCorrect: Boolean(payload.correct),
      source: payload.source || 'theory-level',
      levelId: payload.levelId || ''
    });
    if (!event) return null;
    const theoryEvent = {
      questionId: event.questionId,
      category: event.category,
      questionType: String(payload.questionType || question.questionType || ''),
      knowledgeId,
      difficulty: event.difficulty,
      userAnswer: event.userAnswer,
      correct: event.isCorrect,
      responseTime: event.responseMs,
      createdAt: event.createdAt
    };
    updateState(state => {
      state.theoryAnswerEvents.push(theoryEvent);
      state.theoryAnswerEvents = state.theoryAnswerEvents.slice(-3000);
      const previous = state.theoryMastery[knowledgeId] || {
        knowledgeId,
        attempts: 0,
        correct: 0,
        accuracy: 0,
        weak: false,
        lastPracticedAt: 0,
        recent: []
      };
      const next = { ...previous };
      next.attempts += 1;
      next.correct += theoryEvent.correct ? 1 : 0;
      next.accuracy = next.correct / next.attempts;
      next.recent = [...(next.recent || []), theoryEvent].slice(-20);
      next.weak = next.recent.length >= 3
        && next.recent.filter(item => item.correct).length / next.recent.length < .6;
      next.lastPracticedAt = theoryEvent.createdAt;
      state.theoryMastery[knowledgeId] = next;
      return state;
    });
    return theoryEvent;
  }

  window.HetianEducation = {
    APP_STATE_VERSION,
    STORAGE_KEY,
    defaultEducationState,
    loadEducationState: () => {
      currentState = loadEducationState();
      return getState();
    },
    saveEducationState: value => {
      currentState = saveEducationState(value);
      return getState();
    },
    migrateEducationState,
    resetEducationState,
    exportEducationState,
    importEducationState,
    getState,
    updateState,
    saveProfile,
    profileExists,
    markQuestionShown,
    markReplay,
    recordAnswer,
    recordTheoryAnswer,
    questionKnowledgeIds,
    isoDate
  };
})();
