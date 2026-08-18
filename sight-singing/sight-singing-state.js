(() => {
  'use strict';

  const DB_NAME = 'hetian_sight_singing_v1';
  const DB_VERSION = 1;
  const STORE = 'projects';
  const SETTINGS_KEY = 'hetian_sight_singing_settings_v1';
  const CoreStorage = window.HetianCore?.storage;
  const report = error => CoreStorage?.reportError('sight-singing', error);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createProject(file) {
    const now = Date.now();
    return {
      schemaVersion: 2,
      id: `sight-${now}-${Math.random().toString(36).slice(2, 8)}`,
      title: file?.name ? file.name.replace(/\.[^.]+$/, '') : '未命名视唱练习',
      status: 'prepare',
      createdAt: now,
      updatedAt: now,
      source: {
        type: file?.type || '',
        name: file?.name || '',
        size: file?.size || 0,
        dataUrl: '',
        width: 0,
        height: 0
      },
      preprocessing: {
        rotation: 0,
        contrast: 110,
        threshold: 0,
        crop: { x: 0, y: 0, width: 1, height: 1 }
      },
      score: {
        clef: 'treble',
        keySignature: 0,
        timeSignature: '4/4',
        tempo: 80,
        notes: [],
        questions: []
      },
      recognition: {
        provider: 'homr-offline-adapter',
        completedAt: 0,
        modelVersion: '',
        warnings: []
      },
      review: {
        confirmed: false,
        confirmedAt: 0,
        edits: 0
      },
      practice: {
        sessions: 0,
        lastPracticedAt: 0,
        speed: 1,
        loopEnabled: false,
        loopStart: 1,
        loopEnd: 1,
        metronomeEnabled: true,
        countInEnabled: false,
        measuresPerLine: 4,
        zoom: 145
      }
    };
  }

  function migrateProject(input) {
    if (!input || typeof input !== 'object') return null;
    const defaults = createProject();
    const safe = clone(input);
    const crop = safe.preprocessing?.crop || defaults.preprocessing.crop;
    safe.schemaVersion = 2;
    safe.source = Object.assign(defaults.source, safe.source || {});
    safe.preprocessing = Object.assign(defaults.preprocessing, safe.preprocessing || {}, {
      crop: {
        x: Math.max(0, Math.min(1, Number(crop.x) || 0)),
        y: Math.max(0, Math.min(1, Number(crop.y) || 0)),
        width: Math.max(.02, Math.min(1, Number(crop.width) || 1)),
        height: Math.max(.02, Math.min(1, Number(crop.height) || 1))
      }
    });
    safe.score = Object.assign(defaults.score, safe.score || {}, {
      notes: Array.isArray(safe.score?.notes) ? safe.score.notes : [],
      questions: Array.isArray(safe.score?.questions) ? safe.score.questions : []
    });
    safe.recognition = Object.assign(defaults.recognition, safe.recognition || {});
    safe.review = Object.assign(defaults.review, safe.review || {});
    safe.practice = Object.assign(defaults.practice, safe.practice || {});
    return safe;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('当前环境不支持 IndexedDB'));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.addEventListener('error', () => report(request.error || new Error('视唱本地数据库打开失败')));
      request.addEventListener('blocked', () => report(new Error('视唱本地数据库正在被其他页面占用，请关闭其他软件窗口后重试。')));
      request.onerror = () => reject(request.error || new Error('本地数据库打开失败'));
    });
  }

  async function withStore(mode, action) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const store = transaction.objectStore(STORE);
      transaction.addEventListener('error', () => report(transaction.error || new Error('视唱本地数据库操作失败')));
      let request;
      try {
        request = action(store);
      } catch (error) {
        db.close();
        reject(error);
        return;
      }
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('本地数据操作失败'));
      transaction.oncomplete = () => db.close();
      transaction.onerror = () => {
        db.close();
        reject(transaction.error || new Error('本地事务失败'));
      };
    });
  }

  async function saveProject(project) {
    const safe = migrateProject(project);
    safe.updatedAt = Date.now();
    await withStore('readwrite', store => store.put(safe));
    return safe;
  }

  async function listProjects() {
    const items = await withStore('readonly', store => store.getAll());
    return items.map(migrateProject).filter(Boolean).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  async function getProject(id) {
    return migrateProject(await withStore('readonly', store => store.get(id)));
  }

  async function deleteProject(id) {
    await withStore('readwrite', store => store.delete(id));
  }

  function getSettings() {
    try {
      const raw = CoreStorage ? CoreStorage.readRaw(SETTINGS_KEY) : localStorage.getItem(SETTINGS_KEY);
      return Object.assign({ lastProjectId: '', migrationVersion: 1 }, JSON.parse(raw || '{}'));
    } catch (_) {
      return { lastProjectId: '', migrationVersion: 1 };
    }
  }

  function saveSettings(patch) {
    const next = Object.assign(getSettings(), patch);
    if (CoreStorage) CoreStorage.writeRaw(SETTINGS_KEY, JSON.stringify(next));
    else localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    return next;
  }

  CoreStorage?.register({ namespace: 'sight-settings', key: SETTINGS_KEY, defaults: { lastProjectId: '', migrationVersion: 1 } });
  window.HetianSightStore = {
    DB_NAME,
    createProject,
    migrateProject,
    saveProject,
    listProjects,
    getProject,
    deleteProject,
    getSettings,
    saveSettings
  };
})();
