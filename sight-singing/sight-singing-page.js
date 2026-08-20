(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const Store = window.HetianSightStore;
  const DURATION_NAMES = { 4: '全音符', 2: '二分音符', 1: '四分音符', .5: '八分音符', .25: '十六分音符', .125: '三十二分音符' };
  const REST_DURATION_NAMES = { 4: '全休止符', 2: '二分休止符', 1: '四分休止符', .5: '八分休止符', .25: '十六分休止符', .125: '三十二分休止符' };
  const NOTE_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let project = null;
  let originalImage = null;
  let currentStep = 'prepare';
  let playbackTimers = [];
  let playbackVoices = new Set();
  let playing = false;
  let playbackToken = 0;
  let cropEditing = false;
  let cropDraft = null;
  let cropPointerStart = null;
  let locatingNoteId = '';
  let staffGeometry = [];

  function uid(prefix = 'note') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function setText(id, value) {
    const node = $(id);
    if (node) node.textContent = value;
  }

  function showStatus(id, value, isError = false) {
    const node = $(id);
    if (!node) return;
    node.textContent = value;
    node.style.color = isError ? '#9b342a' : '';
  }

  function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('图片无法打开'));
      image.src = dataUrl;
    });
  }

  async function importImage(file) {
    if (!file) return;
    if (file.size > 24 * 1024 * 1024) {
      alert('图片超过 24MB。请先裁剪到只保留一页乐谱，再重新导入。');
      return;
    }
    try {
      const dataUrl = await readAsDataUrl(file);
      originalImage = await loadImage(dataUrl);
      project = Store.createProject(file);
      project.source.dataUrl = dataUrl;
      project.source.width = originalImage.naturalWidth;
      project.source.height = originalImage.naturalHeight;
      Store.saveSettings({ lastProjectId: project.id });
      $('sightWelcome').classList.add('hidden');
      $('sightHistoryPanel').classList.add('hidden');
      $('sightWorkspace').classList.remove('hidden');
      $('sightEmptyCanvas').classList.add('hidden');
      $('sightReferenceImage').src = dataUrl;
      setText('sightFileMeta', `${file.name} · ${Math.round(file.size / 1024)} KB · ${originalImage.naturalWidth} × ${originalImage.naturalHeight}`);
      showStep('prepare', true);
      renderSource();
      await persist(false);
    } catch (error) {
      alert(`无法导入图片：${error.message}`);
    }
  }

  async function importPdf(file) {
    if (!file) return;
    if (file.size > 40 * 1024 * 1024) {
      alert('PDF 超过 40MB。请先提取需要练习的页面，再重新导入。');
      return;
    }
    try {
      const pdfjs = await import('./vendor/pdfjs/pdf.min.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = './sight-singing/vendor/pdfjs/pdf.worker.min.mjs';
      const data = new Uint8Array(await file.arrayBuffer());
      const documentTask = pdfjs.getDocument({ data, isEvalSupported: false });
      const pdf = await documentTask.promise;
      const page = await pdf.getPage(1);
      const initialViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(3, Math.max(1.5, 2000 / Math.max(initialViewport.width, initialViewport.height)));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PDF 页面转换失败')), 'image/png'));
      const pageFile = new File([blob], `${file.name.replace(/\.pdf$/i, '')}-第1页.png`, { type: 'image/png' });
      await importImage(pageFile);
      project.source.originalType = 'application/pdf';
      project.source.originalName = file.name;
      project.source.pdfPage = 1;
      setText('sightFileMeta', `${file.name} · 第 1 / ${pdf.numPages} 页 · ${project.source.width} × ${project.source.height}`);
      showStatus('sightScanStatus', pdf.numPages > 1 ? `已离线导入第 1 页；原 PDF 共 ${pdf.numPages} 页。` : 'PDF 已离线转换为可校对谱面。');
      await persist(false);
    } catch (error) {
      const message = `PDF 离线导入失败：${error.message}`;
      showStatus('sightScanStatus', message, true);
      alert(message);
    }
  }

  function rotatedSourceCanvas() {
    if (!originalImage || !project) return;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const rotation = ((project.preprocessing.rotation % 360) + 360) % 360;
    const swapped = rotation === 90 || rotation === 270;
    const maxSide = 1800;
    const scale = Math.min(1, maxSide / Math.max(originalImage.naturalWidth, originalImage.naturalHeight));
    const sourceWidth = Math.max(1, Math.round(originalImage.naturalWidth * scale));
    const sourceHeight = Math.max(1, Math.round(originalImage.naturalHeight * scale));
    canvas.width = swapped ? sourceHeight : sourceWidth;
    canvas.height = swapped ? sourceWidth : sourceHeight;
    context.save();
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(rotation * Math.PI / 180);
    context.filter = `contrast(${project.preprocessing.contrast}%)`;
    context.drawImage(originalImage, -sourceWidth / 2, -sourceHeight / 2, sourceWidth, sourceHeight);
    context.restore();

    const threshold = Number(project.preprocessing.threshold || 0);
    if (threshold > 0) {
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const cut = 145 + threshold;
      for (let index = 0; index < data.length; index += 4) {
        const gray = data[index] * .299 + data[index + 1] * .587 + data[index + 2] * .114;
        const value = gray >= cut ? 255 : Math.max(0, gray - threshold * .4);
        data[index] = data[index + 1] = data[index + 2] = value;
      }
      context.putImageData(imageData, 0, 0);
    }
    return canvas;
  }

  function renderSource() {
    if (!originalImage || !project) return;
    const base = rotatedSourceCanvas();
    const canvas = $('sightSourceCanvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const crop = cropEditing ? { x: 0, y: 0, width: 1, height: 1 } : (project.preprocessing.crop || { x: 0, y: 0, width: 1, height: 1 });
    const sx = Math.round(base.width * crop.x);
    const sy = Math.round(base.height * crop.y);
    const sw = Math.max(1, Math.round(base.width * crop.width));
    const sh = Math.max(1, Math.round(base.height * crop.height));
    canvas.width = sw;
    canvas.height = sh;
    context.drawImage(base, sx, sy, sw, sh, 0, 0, sw, sh);
    staffGeometry = detectStaffGeometry(canvas);
    updateCropOverlay();
    const processed = canvas.toDataURL('image/png');
    if ($('sightReferenceImage')) $('sightReferenceImage').src = processed;
  }

  function hasScoreInk(canvas) {
    if (!canvas?.width || !canvas?.height) return false;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const image = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const stride = Math.max(2, Math.floor(Math.min(canvas.width, canvas.height) / 420));
    let total = 0;
    let dark = 0;
    for (let y = 0; y < canvas.height; y += stride) {
      for (let x = 0; x < canvas.width; x += stride) {
        const offset = (y * canvas.width + x) * 4;
        const gray = image[offset] * .299 + image[offset + 1] * .587 + image[offset + 2] * .114;
        total += 1;
        if (gray < 185) dark += 1;
      }
    }
    return total > 0 && dark >= Math.max(12, Math.floor(total / 500));
  }

  function detectStaffGeometry(canvas) {
    if (!canvas?.width || !canvas?.height) return [];
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const candidates = [];
    const stepX = Math.max(1, Math.floor(canvas.width / 900));
    for (let y = 0; y < canvas.height; y += 1) {
      let dark = 0;
      for (let x = 0; x < canvas.width; x += stepX) {
        const offset = (y * canvas.width + x) * 4;
        if (data[offset] + data[offset + 1] + data[offset + 2] < 390) dark += 1;
      }
      if (dark > canvas.width / stepX * .36) candidates.push(y);
    }
    const lines = [];
    candidates.forEach(y => {
      const last = lines.at(-1);
      if (last && y - last.at(-1) <= 2) last.push(y); else lines.push([y]);
    });
    const centers = lines.map(group => group.reduce((a, b) => a + b, 0) / group.length);
    const groups = [];
    for (let index = 0; index <= centers.length - 5; index += 1) {
      const five = centers.slice(index, index + 5);
      const gaps = five.slice(1).map((value, i) => value - five[i]);
      const gap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      if (gap >= 4 && gap <= 40 && gaps.every(value => Math.abs(value - gap) <= Math.max(2, gap * .28))) {
        if (!groups.length || five[0] - groups.at(-1).top > gap * 7) groups.push({ top: five[0], bottom: five[4], gap });
      }
    }
    return groups.map(group => ({ topPct: group.top / canvas.height * 100, bottomPct: group.bottom / canvas.height * 100, gapPct: group.gap / canvas.height * 100 }));
  }

  function canvasDisplayRect() {
    const canvas = $('sightSourceCanvas');
    const wrap = $('sightCanvasWrap');
    const canvasRect = canvas.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    return { canvasRect, wrapRect };
  }

  function updateCropOverlay() {
    const overlay = $('sightCropOverlay');
    if (!cropEditing || !cropDraft) {
      overlay?.classList.add('hidden');
      return;
    }
    const { canvasRect, wrapRect } = canvasDisplayRect();
    overlay.style.left = `${canvasRect.left - wrapRect.left + cropDraft.x * canvasRect.width}px`;
    overlay.style.top = `${canvasRect.top - wrapRect.top + cropDraft.y * canvasRect.height}px`;
    overlay.style.width = `${cropDraft.width * canvasRect.width}px`;
    overlay.style.height = `${cropDraft.height * canvasRect.height}px`;
    overlay.classList.remove('hidden');
  }

  function cropPoint(event) {
    const rect = $('sightSourceCanvas').getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    };
  }

  function startCrop() {
    if (!project || !originalImage) return;
    cropEditing = true;
    cropDraft = Object.assign({}, project.preprocessing.crop || { x: 0, y: 0, width: 1, height: 1 });
    $('sightCanvasWrap').classList.add('cropping');
    $('sightCropStart').classList.add('hidden');
    $('sightCropConfirm').classList.remove('hidden');
    $('sightCropCancel').classList.remove('hidden');
    renderSource();
  }

  function endCrop(apply) {
    if (apply && cropDraft && cropDraft.width >= .02 && cropDraft.height >= .02) project.preprocessing.crop = cropDraft;
    cropEditing = false;
    cropPointerStart = null;
    cropDraft = null;
    $('sightCanvasWrap').classList.remove('cropping');
    $('sightCropStart').classList.remove('hidden');
    $('sightCropConfirm').classList.add('hidden');
    $('sightCropCancel').classList.add('hidden');
    $('sightCropOverlay').classList.add('hidden');
    renderSource();
    if (apply) persist(false);
  }

  function rotateImage(delta) {
    project.preprocessing.rotation += delta;
    project.preprocessing.crop = { x: 0, y: 0, width: 1, height: 1 };
    renderSource();
    persist(false);
  }

  async function persist(showMessage = true) {
    if (!project) return;
    project.updatedAt = Date.now();
    const saved = await Store.saveProject(project);
    project.updatedAt = saved.updatedAt;
    if (showMessage) showStatus('sightSaveStatus', '已保存到本机历史练习。');
  }

  function showStep(step, force = false) {
    if (!project) return;
    if (step === 'practice' && !project.review.confirmed && !force) {
      showStatus('sightScanStatus', '请先逐音校对并点击“确认校对完成”。', true);
      return;
    }
    if (step !== 'practice') stopPlayback();
    currentStep = step;
    const panels = { prepare: 'sightPreparePanel', review: 'sightReviewPanel', practice: 'sightPracticePanel' };
    Object.entries(panels).forEach(([key, id]) => $(id).classList.toggle('hidden', key !== step));
    document.querySelectorAll('[data-sight-step]').forEach(button => button.classList.toggle('active', button.dataset.sightStep === step));
    project.status = step;
    if (step === 'review') renderNotes();
    if (step === 'practice') renderPractice();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function normalizeNote(note) {
    const normalized = Object.assign({
      id: uid(),
      type: 'note',
      rest: false,
      measure: 1,
      name: 'C',
      accidental: '',
      octave: 4,
      duration: 1,
      dotted: false,
      tie: false,
      slur: false,
      triplet: false,
      confidence: 100,
      durationEncoding: 'base',
      position: null
    }, note);
    if (!note.durationEncoding && normalized.dotted && [3, 1.5, .75, .375, .1875].some(value => Math.abs(Number(normalized.duration) - value) < .0001)) {
      normalized.duration = Number(normalized.duration) / 1.5;
    }
    normalized.durationEncoding = 'base';
    normalized.rest = normalized.rest === true || normalized.type === 'rest';
    normalized.type = normalized.rest ? 'rest' : 'note';
    return normalized;
  }

  function noteLabel(note) {
    if (note.rest) return REST_DURATION_NAMES[note.duration] || '休止符';
    const accidental = note.accidental === '#' ? '♯' : note.accidental === 'b' ? '♭' : note.accidental === 'n' ? '♮' : '';
    return `${note.name}${accidental}${note.octave}`;
  }

  function noteMidi(note) {
    if (note.rest) return null;
    const accidentalOffset = note.accidental === '#' ? 1 : note.accidental === 'b' ? -1 : 0;
    return (Number(note.octave) + 1) * 12 + NOTE_PC[note.name] + accidentalOffset;
  }

  function renderNotes() {
    if (!project) return;
    const notes = project.score.notes;
    const list = $('sightNoteList');
    list.innerHTML = '';
    $('sightNoNotes').classList.toggle('hidden', notes.length > 0);
    notes.forEach((raw, index) => {
      const note = normalizeNote(raw);
      Object.assign(raw, note);
      const hasConfidence = Number.isFinite(Number(note.confidence)) && note.confidence !== null;
      const isLow = hasConfidence && Number(note.confidence) < 75;
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `sight-note-item${isLow || !hasConfidence ? ' low' : ''}${note.rest ? ' rest' : ''}`;
      item.dataset.noteId = note.id;
      const confidenceText = hasConfidence ? `${Math.round(note.confidence)}%${isLow ? ' ⚠' : ''}` : '需校对';
      item.innerHTML = `<span class="sight-note-measure">第 ${note.measure} 小节<br>#${index + 1}${note.position?.manual ? ' · 已定位' : ''}</span><b class="sight-note-value">${note.rest ? '𝄽' : noteLabel(note)}</b><span class="sight-note-duration">${note.rest ? (REST_DURATION_NAMES[note.duration] || '自定义休止符') : (DURATION_NAMES[note.duration] || '自定义时值')}${note.dotted ? ' · 附点' : ''}</span><span class="sight-confidence">${confidenceText}</span>`;
      item.addEventListener('click', () => openNoteDialog(note.id));
      list.appendChild(item);
    });
    const measures = notes.reduce((max, note) => Math.max(max, Number(note.measure) || 1), 1);
    const restCount = notes.filter(note => note.rest).length;
    setText('sightNoteSummary', `${notes.length - restCount} 个音符 · ${restCount} 个休止符 · ${notes.length ? measures : 0} 小节`);
    const questions = project.score.questions || [];
    setText('sightQuestionSummary', questions.length ? `识别到题号：${questions.map(item => item.number).join('、')}` : '点击音符后可在图上定位');
  }

  function syncEditorType() {
    const isRest = $('sightEditType').value === 'rest';
    document.querySelectorAll('[data-sight-pitch-field]').forEach(field => field.classList.toggle('hidden', isRest));
    $('sightEditTie').closest('label').classList.toggle('hidden', isRest);
    $('sightEditSlur').closest('label').classList.toggle('hidden', isRest);
  }

  function openNoteDialog(id = '', initialType = 'note') {
    const note = id ? project.score.notes.find(item => item.id === id) : normalizeNote({ id: '', type: initialType, rest: initialType === 'rest' });
    if (!note) return;
    $('sightEditId').value = note.id || '';
    $('sightEditType').value = note.rest ? 'rest' : 'note';
    $('sightEditMeasure').value = note.measure;
    $('sightEditName').value = note.name;
    $('sightEditAccidental').value = note.accidental;
    $('sightEditOctave').value = note.octave;
    $('sightEditDuration').value = note.duration;
    $('sightEditConfidence').value = note.confidence === null ? '' : note.confidence;
    $('sightEditDotted').checked = Boolean(note.dotted);
    $('sightEditTie').checked = Boolean(note.tie);
    $('sightEditSlur').checked = Boolean(note.slur);
    $('sightEditTriplet').checked = Boolean(note.triplet);
    syncEditorType();
    $('sightDeleteNote').classList.toggle('hidden', !id);
    $('sightNoteDialog').showModal();
  }

  function noteFromForm() {
    const isRest = $('sightEditType').value === 'rest';
    const existing = project.score.notes.find(note => note.id === $('sightEditId').value);
    return normalizeNote({
      id: $('sightEditId').value || uid(),
      type: isRest ? 'rest' : 'note',
      rest: isRest,
      measure: Math.max(1, Number($('sightEditMeasure').value) || 1),
      name: $('sightEditName').value,
      accidental: $('sightEditAccidental').value,
      octave: Number($('sightEditOctave').value),
      duration: Number($('sightEditDuration').value),
      confidence: Math.min(100, Math.max(0, Number($('sightEditConfidence').value) || 0)),
      dotted: $('sightEditDotted').checked,
      tie: isRest ? false : $('sightEditTie').checked,
      slur: isRest ? false : $('sightEditSlur').checked,
      triplet: $('sightEditTriplet').checked,
      position: existing?.position || null,
      durationEncoding: 'base'
    });
  }

  function applyNote() {
    const next = noteFromForm();
    const index = project.score.notes.findIndex(note => note.id === next.id);
    if (index >= 0) project.score.notes[index] = next;
    else project.score.notes.push(next);
    project.score.notes.sort((a, b) => Number(a.measure) - Number(b.measure));
    project.review.confirmed = false;
    project.review.edits += 1;
    $('sightNoteDialog').close();
    renderNotes();
    persist(false);
  }

  function deleteNote() {
    const id = $('sightEditId').value;
    if (!id) return;
    project.score.notes = project.score.notes.filter(note => note.id !== id);
    project.review.confirmed = false;
    project.review.edits += 1;
    $('sightNoteDialog').close();
    renderNotes();
    persist(false);
  }

  function beginLocateNote() {
    const id = $('sightEditId').value;
    if (!id) {
      showStatus('sightScanStatus', '请先应用新增音符，再为它定位。', true);
      return;
    }
    locatingNoteId = id;
    $('sightNoteDialog').close();
    $('sightReferenceStage').classList.add('locating');
    setText('sightQuestionSummary', '请在左侧谱面点击这个音符的音符头');
  }

  function locateNoteAtEvent(event) {
    if (!locatingNoteId) return;
    const image = $('sightReferenceImage');
    const rect = image.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100));
    const y = Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100));
    const note = project.score.notes.find(item => item.id === locatingNoteId);
    if (note) note.position = { xPct: x, yPct: y, manual: true };
    const pin = $('sightReviewPin');
    pin.style.left = `${x}%`;
    pin.style.top = `${y}%`;
    pin.classList.remove('hidden');
    locatingNoteId = '';
    $('sightReferenceStage').classList.remove('locating');
    project.review.confirmed = false;
    project.review.edits += 1;
    renderNotes();
    persist(false);
  }

  async function diagnoseEngine() {
    const report = await window.HetianOMR.diagnose();
    $('sightRuntimeDot').className = report.runtimeReady ? 'ok' : 'bad';
    $('sightModelDot').className = report.modelsReady ? 'ok' : 'bad';
    setText('sightRuntimeText', report.runtimeReady ? `可用 · ${report.provider}` : '不可用');
    setText('sightModelText', report.ready ? '已安装' : '未安装');
    const connectedText = report.provider === 'personal-remote-homr'
      ? 'Windows 远程识谱已连接'
      : report.provider === 'cloud-homr' ? '云端识谱已连接' : '本地识谱引擎已就绪';
    setText('sightEngineTitle', report.message || (report.ready ? connectedText : '识谱引擎尚未连接'));
    $('sightRecognizeButton').disabled = !report.ready;
    $('sightRecognizeButton').textContent = report.provider === 'personal-remote-homr' || report.provider === 'cloud-homr' ? '开始远程识别' : '开始本地识别';
    $('sightRecognizeButton').title = report.ready ? '' : '当前平台尚未接通本机识谱桥，可先使用人工校对稿';
    return report;
  }

  function openRemoteDialog() {
    const config = window.HetianOMR.getRemoteConfig?.();
    $('sightRemoteUrl').value = config?.baseUrl || '';
    $('sightRemoteToken').value = '';
    $('sightRemoteToken').placeholder = config?.serviceToken ? '口令已保存；只修改地址时可留空' : 'personal-omr-server.config.json 中的 serviceToken';
    showStatus('sightRemoteStatus', config ? '当前浏览器已保存远程连接。' : '尚未保存远程连接。');
    $('sightRemoteDialog').showModal();
  }

  async function saveRemoteConnection() {
    const previous = window.HetianOMR.getRemoteConfig?.();
    try {
      window.HetianOMR.configureRemote($('sightRemoteUrl').value, $('sightRemoteToken').value || previous?.serviceToken);
      showStatus('sightRemoteStatus', '正在检测 Windows 识谱服务…');
      const report = await diagnoseEngine();
      if (report.provider !== 'personal-remote-homr' || !report.ready) throw new Error('没有连接成功，请确认电脑上的两个窗口仍在运行');
      showStatus('sightRemoteStatus', '连接成功，可以关闭此窗口开始识谱。');
      setTimeout(() => $('sightRemoteDialog').close(), 700);
    } catch (error) { showStatus('sightRemoteStatus', error.message, true); }
  }

  function clearRemoteConnection() {
    window.HetianOMR.clearRemote?.();
    $('sightRemoteUrl').value = '';
    $('sightRemoteToken').value = '';
    showStatus('sightRemoteStatus', '远程连接已清除。');
    diagnoseEngine();
  }

  async function recognize() {
    if (!project?.source.dataUrl) {
      showStatus('sightScanStatus', '请先导入一张印刷五线谱图片。', true);
      return;
    }
    showStatus('sightScanStatus', '正在本机处理谱面，请稍候…');
    try {
      const canvas = $('sightSourceCanvas');
      if (!hasScoreInk(canvas)) {
        throw new Error('当前裁剪区域几乎是空白，未开始识别。请先把裁剪框调整到实际五线谱区域，并适当降低去灰度。');
      }
      const result = await window.HetianOMR.recognize({
        imageDataUrl: canvas.toDataURL('image/png'),
        preprocessing: project.preprocessing
      });
      project.score.notes = (result.notes || []).map(normalizeNote);
      project.score.questions = Array.isArray(result.questionMarkers) ? result.questionMarkers : [];
      if (result.clef) project.score.clef = result.clef;
      if (Number.isFinite(Number(result.keySignature))) project.score.keySignature = Number(result.keySignature);
      if (result.timeSignature) project.score.timeSignature = result.timeSignature;
      if (Number.isFinite(Number(result.tempo))) project.score.tempo = Number(result.tempo);
      project.recognition.completedAt = Date.now();
      project.recognition.modelVersion = result.modelVersion || '';
      project.recognition.warnings = Array.isArray(result.warnings) ? result.warnings.slice() : [];
      project.review.confirmed = false;
      showStatus('sightScanStatus', `识别完成：${project.score.notes.length} 个音符。请逐音校对后再播放。`);
      showStep('review', true);
      await persist(false);
    } catch (error) {
      showStatus('sightScanStatus', error.message, true);
    }
  }

  function buildManualDraft() {
    if (!project?.source.dataUrl) {
      showStatus('sightScanStatus', '请先导入图片，再建立校对稿。', true);
      return;
    }
    if (!project.score.notes.length) project.score.notes = [];
    project.review.confirmed = false;
    showStep('review', true);
  }

  function confirmReview() {
    if (!project.score.notes.length) {
      alert('校对稿中还没有音符。请至少添加一个音符后再确认。');
      return;
    }
    const lowCount = project.score.notes.filter(note => note.confidence !== null && Number(note.confidence) < 75).length;
    const unknownCount = project.score.notes.filter(note => note.confidence === null).length;
    if (lowCount && !confirm(`仍有 ${lowCount} 个低可信度音符。你确认已经人工检查过它们吗？`)) return;
    if (unknownCount && !confirm(`有 ${unknownCount} 个音符没有模型可信度，已标记为“需校对”。你确认已经逐个检查过吗？`)) return;
    project.review.confirmed = true;
    project.review.confirmedAt = Date.now();
    persist(false);
    showStep('practice', true);
  }

  function stopPlayback() {
    playbackToken += 1;
    playbackTimers.forEach(timer => clearTimeout(timer));
    playbackTimers = [];
    playbackVoices.forEach(voice => {
      const now = voice.context?.currentTime || 0;
      try {
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(.0001, now);
      } catch (_) {}
      (voice.sources || voice.oscillators || []).forEach(source => { try { source.stop(now + .01); } catch (_) {} });
    });
    playbackVoices.clear();
    playing = false;
    if ($('sightPlayButton')) $('sightPlayButton').textContent = '▶';
    document.querySelectorAll('.sight-timeline-note.active').forEach(node => node.classList.remove('active'));
    $('sightFollowOrb')?.classList.remove('active', 'resting');
    $('sightPracticeMeasureBand')?.classList.remove('active');
  }

  function playTone(midi, start, duration) {
    const Audio = window.AudioContext || window.webkitAudioContext;
    const context = window.HetianApp?.getAudio?.() || new Audio();
    if (window.HetianPiano?.isReady?.()) {
      const sampled = window.HetianPiano.play(context, midi, start, duration, .72);
      if (sampled) {
        playbackVoices.add(sampled);
        return;
      }
    }
    const frequency = 440 * Math.pow(2, (midi - 69) / 12);
    const master = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 3600;
    master.connect(filter);
    filter.connect(context.destination);
    master.gain.setValueAtTime(.0001, start);
    master.gain.exponentialRampToValueAtTime(.26 * (window.HetianSettings?.getVolume?.() ?? 1), start + .012);
    master.gain.exponentialRampToValueAtTime(.0001, start + Math.max(.2, duration * .88));
    const voice = { context, gain: master, oscillators: [], sources: [], ended: 0 };
    playbackVoices.add(voice);
    [[1, 'sine', 1], [2, 'sine', .38], [3, 'triangle', .15]].forEach(([ratio, type, gain]) => {
      const oscillator = context.createOscillator();
      const partialGain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency * ratio;
      partialGain.gain.value = gain;
      oscillator.connect(partialGain);
      partialGain.connect(master);
      voice.oscillators.push(oscillator);
      voice.sources.push(oscillator);
      oscillator.start(start);
      oscillator.stop(start + duration);
      oscillator.addEventListener('ended', () => {
        voice.ended += 1;
        if (voice.ended >= voice.oscillators.length) playbackVoices.delete(voice);
      }, { once: true });
    });
  }

  function playMetronomeClick(context, when, accent = false) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(accent ? 1450 : 980, when);
    gain.gain.setValueAtTime(.0001, when);
    gain.gain.exponentialRampToValueAtTime(accent ? .16 : .085, when + .002);
    gain.gain.exponentialRampToValueAtTime(.0001, when + .045);
    oscillator.connect(gain);
    gain.connect(context.destination);
    const voice = { context, gain, sources: [oscillator], oscillators: [oscillator] };
    playbackVoices.add(voice);
    oscillator.start(when);
    oscillator.stop(when + .055);
    oscillator.addEventListener('ended', () => playbackVoices.delete(voice), { once: true });
  }

  function practiceImageDataUrl() {
    const canvas = $('sightSourceCanvas');
    if (canvas?.width && canvas?.height) {
      try { return canvas.toDataURL('image/png'); } catch (_) {}
    }
    return project?.source?.dataUrl || '';
  }

  function followPosition(note, globalIndex, notes) {
    if (note.position?.manual) return { x: Number(note.position.xPct), y: Number(note.position.yPct), row: 0, column: 0, rows: 1, perLine: 1, manual: true, globalIndex };
    const perLine = Math.max(2, Number($('sightMeasuresPerLine')?.value) || 4);
    const measure = Math.max(1, Number(note.measure) || 1);
    const maxMeasure = notes.reduce((max, item) => Math.max(max, Number(item.measure) || 1), 1);
    const rows = Math.max(1, Math.ceil(maxMeasure / perLine));
    const row = Math.min(rows - 1, Math.floor((measure - 1) / perLine));
    const column = (measure - 1) % perLine;
    const inMeasure = notes.filter(item => Number(item.measure) === measure);
    const localIndex = Math.max(0, inMeasure.findIndex(item => item.id === note.id));
    const leftMargin = 6;
    const usableWidth = 88;
    const x = leftMargin + usableWidth * ((column + (localIndex + .5) / Math.max(1, inMeasure.length)) / perLine);
    let y = rows === 1 ? 50 : 10 + 80 * ((row + .5) / rows);
    if (!note.rest && staffGeometry.length) {
      const staff = staffGeometry[Math.min(staffGeometry.length - 1, Math.round(row * (staffGeometry.length - 1) / Math.max(1, rows - 1)))];
      const diatonicIndex = Number(note.octave) * 7 + ['C', 'D', 'E', 'F', 'G', 'A', 'B'].indexOf(note.name);
      const bottomReference = project.score.clef === 'bass' ? 2 * 7 + 4 : project.score.clef === 'alto' ? 3 * 7 + 3 : 4 * 7 + 2;
      y = staff.bottomPct - (diatonicIndex - bottomReference) * staff.gapPct / 2;
      y = Math.max(staff.topPct - staff.gapPct * 4, Math.min(staff.bottomPct + staff.gapPct * 4, y));
    }
    return { x, y, row, column, rows, perLine, globalIndex };
  }

  function moveFollowMarker(note, index, notes) {
    const orb = $('sightFollowOrb');
    const band = $('sightPracticeMeasureBand');
    const sheet = $('sightPracticeScoreSheet');
    const stage = $('sightPracticeScoreStage');
    if (!orb || !band || !sheet || !stage) return;
    const position = followPosition(note, index, notes);
    orb.style.left = `${position.x}%`;
    orb.style.top = `${position.y}%`;
    orb.classList.toggle('resting', Boolean(note.rest));
    orb.classList.add('active');
    if (!position.manual) {
      const rowHeight = 80 / position.rows;
      band.style.left = `${6 + 88 * position.column / position.perLine}%`;
      band.style.width = `${88 / position.perLine}%`;
      band.style.top = `${10 + rowHeight * position.row}%`;
      band.style.height = `${rowHeight}%`;
      band.classList.add('active');
    } else {
      band.classList.remove('active');
    }
    const targetX = sheet.offsetWidth * position.x / 100;
    const targetY = sheet.offsetHeight * position.y / 100;
    stage.scrollTo({
      left: Math.max(0, targetX - stage.clientWidth / 2),
      top: Math.max(0, targetY - stage.clientHeight / 2),
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    });
  }

  function selectedNotes() {
    const all = project.score.notes;
    if (!$('sightLoopToggle').classList.contains('active')) return all;
    const from = Number($('sightLoopStart').value) || 1;
    const to = Number($('sightLoopEnd').value) || from;
    return all.filter(note => Number(note.measure) >= Math.min(from, to) && Number(note.measure) <= Math.max(from, to));
  }

  async function startPlayback() {
    if (playing) {
      stopPlayback();
      return;
    }
    if (!project?.review.confirmed) {
      alert('播放已阻止：请先完成人工校对并确认。');
      return;
    }
    const notes = selectedNotes().map(normalizeNote);
    if (!notes.length) {
      alert('当前循环范围内没有音符。');
      return;
    }
    stopPlayback();
    playing = true;
    $('sightPlayButton').textContent = '■';
    const token = ++playbackToken;
    const speed = Number($('sightSpeed').value) || 1;
    const tempo = Math.min(220, Math.max(30, Number($('sightTempo').value) || 80));
    const beatSeconds = 60 / tempo / speed;
    const context = window.HetianApp?.getAudio?.();
    await context?.resume?.();
    if (window.HetianPiano?.prepare && !window.HetianPiano.isReady()) {
      setText('sightPianoStatus', '正在载入本地真钢琴采样…');
      try {
        await window.HetianPiano.prepare(context);
        setText('sightPianoStatus', '已启用离线真钢琴采样。');
      } catch (_) {
        setText('sightPianoStatus', '采样暂不可用，已切换到离线合成钢琴。');
      }
      if (token !== playbackToken) return;
    }
    const meter = String(project.score.timeSignature || '4/4').split('/').map(Number);
    const beatsPerMeasure = Math.max(1, meter[0] || 4);
    const clickBeatQuarter = 4 / Math.max(1, meter[1] || 4);
    const countInBeats = $('sightCountInToggle')?.checked ? beatsPerMeasure * clickBeatQuarter : 0;
    let offset = .08 + countInBeats * beatSeconds;

    const noteBeatTotal = notes.reduce((sum, note) => sum + Number(note.duration) * (note.dotted ? 1.5 : 1) * (note.triplet ? 2 / 3 : 1), 0);
    if ($('sightMetronomeToggle')?.checked || countInBeats) {
      const totalQuarterBeats = countInBeats + noteBeatTotal;
      for (let beat = 0, ordinal = 0; beat < totalQuarterBeats - .0001; beat += clickBeatQuarter, ordinal += 1) {
        const inCountIn = beat < countInBeats;
        if (inCountIn || $('sightMetronomeToggle')?.checked) playMetronomeClick(context, context.currentTime + .08 + beat * beatSeconds, ordinal % beatsPerMeasure === 0);
      }
    }

    notes.forEach((note, index) => {
      const durationBeats = Number(note.duration) * (note.dotted ? 1.5 : 1) * (note.triplet ? 2 / 3 : 1);
      const duration = Math.max(.08, durationBeats * beatSeconds);
      if (!note.rest) playTone(noteMidi(note), context.currentTime + offset, duration);
      const timer = setTimeout(() => {
        if (token !== playbackToken) return;
        setText('sightNowNote', noteLabel(note));
        setText('sightPlayProgress', `${index + 1} / ${notes.length}`);
        document.querySelectorAll('.sight-timeline-note').forEach(node => node.classList.toggle('active', node.dataset.noteId === note.id));
        moveFollowMarker(note, index, project.score.notes);
      }, offset * 1000);
      playbackTimers.push(timer);
      offset += duration;
    });

    playbackTimers.push(setTimeout(() => {
      if (token !== playbackToken) return;
      const looping = $('sightLoopToggle').classList.contains('active');
      stopPlayback();
      if (looping) startPlayback();
      else {
        project.practice.sessions += 1;
        project.practice.lastPracticedAt = Date.now();
        persist(false);
      }
    }, (offset + .08) * 1000));
  }

  function renderPractice() {
    if (!project) return;
    setText('sightProjectTitle', project.title);
    $('sightProjectName').value = project.title;
    $('sightTempo').value = project.score.tempo || 80;
    $('sightMetronomeToggle').checked = project.practice.metronomeEnabled !== false;
    $('sightCountInToggle').checked = Boolean(project.practice.countInEnabled);
    $('sightMeasuresPerLine').value = String(project.practice.measuresPerLine || 4);
    $('sightPracticeZoom').value = String(project.practice.zoom || 145);
    $('sightPracticeScoreSheet').style.width = `${project.practice.zoom || 145}%`;
    const practiceImage = $('sightPracticeImage');
    if (practiceImage) practiceImage.src = practiceImageDataUrl();
    const measures = project.score.notes.reduce((max, note) => Math.max(max, Number(note.measure) || 1), 1);
    $('sightLoopStart').max = measures;
    $('sightLoopEnd').max = measures;
    $('sightLoopEnd').value = Math.min(measures, Number(project.practice.loopEnd) || measures);
    const timeline = $('sightPracticeTimeline');
    timeline.innerHTML = '';
    project.score.notes = project.score.notes.map(normalizeNote);
    project.score.notes.forEach(note => {
      const item = document.createElement('div');
      item.className = 'sight-timeline-note';
      item.dataset.noteId = note.id;
      item.classList.toggle('rest', Boolean(note.rest));
      item.innerHTML = `<b>${note.rest ? '休' : noteLabel(note)}</b><small>第 ${note.measure} 小节</small>`;
      timeline.appendChild(item);
    });
    setText('sightPlayProgress', `0 / ${project.score.notes.length}`);
  }

  async function saveFromPractice() {
    project.title = $('sightProjectName').value.trim() || '未命名视唱练习';
    project.score.tempo = Math.min(220, Math.max(30, Number($('sightTempo').value) || 80));
    project.practice.speed = Number($('sightSpeed').value) || 1;
    project.practice.loopEnabled = $('sightLoopToggle').classList.contains('active');
    project.practice.loopStart = Number($('sightLoopStart').value) || 1;
    project.practice.loopEnd = Number($('sightLoopEnd').value) || 1;
    project.practice.metronomeEnabled = $('sightMetronomeToggle').checked;
    project.practice.countInEnabled = $('sightCountInToggle').checked;
    project.practice.measuresPerLine = Number($('sightMeasuresPerLine').value) || 4;
    project.practice.zoom = Number($('sightPracticeZoom').value) || 145;
    await persist(true);
    setText('sightProjectTitle', project.title);
  }

  function resetView() {
    stopPlayback();
    project = null;
    originalImage = null;
    $('sightWelcome').classList.remove('hidden');
    $('sightWorkspace').classList.add('hidden');
    $('sightHistoryPanel').classList.add('hidden');
    $('sightSourceCanvas').width = 0;
    $('sightSourceCanvas').height = 0;
    $('sightReferenceImage').removeAttribute('src');
    $('sightEmptyCanvas').classList.remove('hidden');
    ['sightCameraInput', 'sightImageInput', 'sightPdfInput'].forEach(id => { $(id).value = ''; });
  }

  async function openProject(id) {
    const saved = await Store.getProject(id);
    if (!saved) return;
    project = saved;
    try {
      originalImage = await loadImage(saved.source.dataUrl);
      $('sightReferenceImage').src = saved.source.dataUrl;
      $('sightWelcome').classList.add('hidden');
      $('sightHistoryPanel').classList.add('hidden');
      $('sightWorkspace').classList.remove('hidden');
      $('sightEmptyCanvas').classList.add('hidden');
      setText('sightFileMeta', `${saved.source.name || saved.title} · ${saved.source.width} × ${saved.source.height}`);
      $('sightContrast').value = saved.preprocessing.contrast;
      $('sightThreshold').value = saved.preprocessing.threshold;
      renderSource();
      showStep(saved.review.confirmed ? 'practice' : (saved.status === 'prepare' ? 'prepare' : 'review'), true);
    } catch (error) {
      alert(`历史项目的源图无法打开：${error.message}`);
    }
  }

  async function showHistory() {
    stopPlayback();
    $('sightWelcome').classList.add('hidden');
    $('sightWorkspace').classList.add('hidden');
    $('sightHistoryPanel').classList.remove('hidden');
    const list = $('sightHistoryList');
    list.innerHTML = '';
    try {
      const projects = await Store.listProjects();
      $('sightHistoryEmpty').classList.toggle('hidden', projects.length > 0);
      projects.forEach(item => {
        const card = document.createElement('article');
        card.className = 'sight-history-card';
        const date = new Date(item.updatedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        card.innerHTML = `<span class="sight-eyebrow">${item.review?.confirmed ? '已确认' : '待校对'}</span><h3>${escapeHtml(item.title)}</h3><p>${item.score?.notes?.length || 0} 个音符 · 更新于 ${date}</p><footer><button class="sight-primary open-project" type="button">继续练习</button><button class="sight-secondary delete-project" type="button">删除</button></footer>`;
        card.querySelector('.open-project').addEventListener('click', () => openProject(item.id));
        card.querySelector('.delete-project').addEventListener('click', async () => {
          if (!confirm(`确认删除“${item.title}”吗？源图、校对稿和练习记录都会从本机移除。`)) return;
          await Store.deleteProject(item.id);
          showHistory();
        });
        list.appendChild(card);
      });
    } catch (error) {
      $('sightHistoryEmpty').classList.remove('hidden');
      $('sightHistoryEmpty').textContent = `本机历史暂不可用：${error.message}`;
    }
  }

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value || '';
    return div.innerHTML;
  }

  $('sightCameraButton').addEventListener('click', () => $('sightCameraInput').click());
  $('sightImageButton').addEventListener('click', () => $('sightImageInput').click());
  $('sightPdfButton').addEventListener('click', () => $('sightPdfInput').click());
  $('sightCameraInput').addEventListener('change', event => importImage(event.target.files[0]));
  $('sightImageInput').addEventListener('change', event => importImage(event.target.files[0]));
  $('sightPdfInput').addEventListener('change', event => importPdf(event.target.files[0]));
  $('sightHistoryButton').addEventListener('click', showHistory);
  $('sightRemoteButton').addEventListener('click', openRemoteDialog);
  $('sightRemoteSave').addEventListener('click', saveRemoteConnection);
  $('sightRemoteClear').addEventListener('click', clearRemoteConnection);
  $('sightHistoryBack').addEventListener('click', () => project ? ($('sightHistoryPanel').classList.add('hidden'), $('sightWorkspace').classList.remove('hidden')) : resetView());
  $('sightNewButton').addEventListener('click', () => {
    if (project && !confirm('新建会离开当前页面；已保存的项目仍会保留。继续吗？')) return;
    resetView();
  });
  document.querySelectorAll('[data-sight-step]').forEach(button => button.addEventListener('click', () => showStep(button.dataset.sightStep)));
  $('sightRotateLeft').addEventListener('click', () => rotateImage(-90));
  $('sightRotateRight').addEventListener('click', () => rotateImage(90));
  $('sightCropStart').addEventListener('click', startCrop);
  $('sightCropConfirm').addEventListener('click', () => endCrop(true));
  $('sightCropCancel').addEventListener('click', () => endCrop(false));
  $('sightSourceCanvas').addEventListener('pointerdown', event => {
    if (!cropEditing) return;
    event.preventDefault();
    cropPointerStart = cropPoint(event);
    cropDraft = { x: cropPointerStart.x, y: cropPointerStart.y, width: .001, height: .001 };
    $('sightSourceCanvas').setPointerCapture?.(event.pointerId);
    updateCropOverlay();
  });
  $('sightSourceCanvas').addEventListener('pointermove', event => {
    if (!cropEditing || !cropPointerStart) return;
    event.preventDefault();
    const point = cropPoint(event);
    cropDraft = { x: Math.min(point.x, cropPointerStart.x), y: Math.min(point.y, cropPointerStart.y), width: Math.abs(point.x - cropPointerStart.x), height: Math.abs(point.y - cropPointerStart.y) };
    updateCropOverlay();
  });
  $('sightSourceCanvas').addEventListener('pointerup', event => {
    if (!cropEditing) return;
    cropPointerStart = null;
    $('sightSourceCanvas').releasePointerCapture?.(event.pointerId);
  });
  $('sightContrast').addEventListener('input', event => { project.preprocessing.contrast = Number(event.target.value); renderSource(); });
  $('sightThreshold').addEventListener('input', event => { project.preprocessing.threshold = Number(event.target.value); renderSource(); });
  $('sightContrast').addEventListener('change', () => persist(false));
  $('sightThreshold').addEventListener('change', () => persist(false));
  $('sightResetImage').addEventListener('click', () => {
    project.preprocessing = { rotation: 0, contrast: 110, threshold: 0, crop: { x: 0, y: 0, width: 1, height: 1 } };
    $('sightContrast').value = 110;
    $('sightThreshold').value = 0;
    renderSource();
  });
  $('sightRecognizeButton').addEventListener('click', recognize);
  $('sightManualDraftButton').addEventListener('click', buildManualDraft);
  $('sightAddNote').addEventListener('click', () => openNoteDialog());
  $('sightAddRest').addEventListener('click', () => openNoteDialog('', 'rest'));
  $('sightEditType').addEventListener('change', syncEditorType);
  $('sightLocateNote').addEventListener('click', beginLocateNote);
  $('sightReferenceStage').addEventListener('click', locateNoteAtEvent);
  $('sightApplyNote').addEventListener('click', applyNote);
  $('sightDeleteNote').addEventListener('click', deleteNote);
  $('sightConfirmReview').addEventListener('click', confirmReview);
  $('sightPlayButton').addEventListener('click', startPlayback);
  $('sightLoopToggle').addEventListener('click', event => {
    event.currentTarget.classList.toggle('active');
    event.currentTarget.textContent = `循环困难小节：${event.currentTarget.classList.contains('active') ? '开' : '关'}`;
    stopPlayback();
  });
  $('sightSaveProject').addEventListener('click', saveFromPractice);
  $('sightBackToReview').addEventListener('click', () => { stopPlayback(); showStep('review', true); });
  $('sightPracticeZoom').addEventListener('input', event => {
    $('sightPracticeScoreSheet').style.width = `${Number(event.target.value) || 145}%`;
    if (project) project.practice.zoom = Number(event.target.value) || 145;
  });
  $('sightMeasuresPerLine').addEventListener('change', () => {
    if (project) project.practice.measuresPerLine = Number($('sightMeasuresPerLine').value) || 4;
    const activeId = document.querySelector('.sight-timeline-note.active')?.dataset.noteId;
    const index = project?.score?.notes?.findIndex(note => note.id === activeId) ?? -1;
    if (index >= 0) moveFollowMarker(project.score.notes[index], index, project.score.notes);
  });
  window.addEventListener('musictoolbox:pagechange', event => {
    if (event.detail?.id !== 'sightSinging') stopPlayback();
  });
  window.addEventListener('musictoolbox:stopaudio', stopPlayback);
  window.addEventListener('pagehide', stopPlayback);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopPlayback(); });
  window.HetianSightPlayback = { stop: stopPlayback };
  window.HetianCore?.audio?.registerStopper('sightSinging', stopPlayback);

  diagnoseEngine().catch(error => {
    setText('sightEngineTitle', '识别引擎检查失败');
    showStatus('sightScanStatus', error.message, true);
  });
})();
