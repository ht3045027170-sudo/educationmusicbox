(() => {
  'use strict';
  const NS = window.MusicScore = window.MusicScore || {};
  const DB_NAME = 'HetianMusicScoreDB', DB_VERSION = 1, STORE = 'scores', RECENT_KEY = 'hetianScoreRecentV1';
  const CoreStorage = window.HetianCore?.storage;
  let openPromise = null;
  const report = error => CoreStorage?.reportError('score', error);
  const localRead = key => CoreStorage ? CoreStorage.readRaw(key) : localStorage.getItem(key);
  function localWrite(key, value) {
    if (CoreStorage) {
      if (!CoreStorage.writeRaw(key, value)) throw new Error('制谱本地数据保存失败，请先导出工程备份后释放存储空间。');
      return;
    }
    localStorage.setItem(key, value);
  }
  function openDb() {
    if (!('indexedDB' in window)) return Promise.resolve(null);
    if (openPromise) return openPromise;
    openPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => { const error = request.error || new Error('制谱本地数据库不可用'); openPromise = null; report(error); resolve(null); };
      request.onblocked = () => report(new Error('制谱本地数据库正在被其他页面占用，请关闭其他软件窗口后重试。'));
    });
    return openPromise;
  }
  async function put(score) {
    const db = await openDb();
    score.metadata.updatedAt = Date.now();
    if (!db) {
      localWrite(`hetianScore:${score.id}`, JSON.stringify(score));
      updateRecent(score);
      return score;
    }
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(score);
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
    updateRecent(score);
    return score;
  }
  async function get(id) {
    const db = await openDb();
    if (!db) { try { return JSON.parse(localRead(`hetianScore:${id}`) || 'null'); } catch (error) { report(error); return null; } }
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }
  async function remove(id) {
    const db = await openDb();
    if (db) await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(id);
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
    else localStorage.removeItem(`hetianScore:${id}`);
    const recent = listRecent().filter(item => item.id !== id);
    localWrite(RECENT_KEY, JSON.stringify(recent));
  }
  function listRecent() {
    try { return JSON.parse(localRead(RECENT_KEY) || '[]'); } catch (error) { report(error); return []; }
  }
  function updateRecent(score) {
    const item = { id: score.id, title: score.metadata.title, updatedAt: score.metadata.updatedAt };
    const recent = [item, ...listRecent().filter(entry => entry.id !== score.id)].slice(0, 12);
    localWrite(RECENT_KEY, JSON.stringify(recent));
    localWrite('hetianScoreLastId', score.id);
  }
  function autosave(callback, delay = 1200) {
    let timer = 0;
    return {
      schedule() { clearTimeout(timer); timer = setTimeout(callback, delay); },
      flush() { clearTimeout(timer); return callback(); },
      cancel() { clearTimeout(timer); }
    };
  }
  function lastId() { return localRead('hetianScoreLastId') || ''; }
  CoreStorage?.register({ namespace: 'score-recent', key: RECENT_KEY, defaults: [] });
  NS.storage = { openDb, put, get, remove, listRecent, lastId, autosave };
})();
