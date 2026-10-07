(() => {
  'use strict';
  const root = window.MusicVocal, E = root.TunerEngine;
  const strings = [{ note:'E2', midi:40, label:'⑥弦' }, { note:'A2', midi:45, label:'⑤弦' }, { note:'D3', midi:50, label:'④弦' }, { note:'G3', midi:55, label:'③弦' }, { note:'B3', midi:59, label:'②弦' }, { note:'E4', midi:64, label:'①弦' }];
  const $ = id => document.getElementById(id);
  const read = (key, fallback) => { try { return localStorage.getItem(key) || fallback; } catch (_) { return fallback; } };
  const save = (key, value) => { try { localStorage.setItem(key, value); } catch (_) {} };
  const input = new E.Input(), tracker = new E.Tracker();
  let page = 'guitar', mode = 'manual', target = strings[0], reference = Number(read('haitangTunerReference', '440'));
  if (!Number.isFinite(reference) || reference < 430 || reference > 450) reference = 440;
  let running = false, starting = false, generation = 0, raf = 0, lastFrame = 0, detector, buffer;
  let candidate = null, candidateSince = 0, oscillator = null, toneTimer = 0, toneGeneration = 0;
  let erhuNotes = ['D4', 'A4'];
  const prefix = () => page === 'erhu' ? 'erhuTuner' : 'tuner';
  const el = suffix => $(prefix() + suffix);
  function status(text, state = '') { el('Status').textContent = text; el('Status').className = 'tuner-status ' + state; }
  function clearReading() {
    el('Freq').textContent = '— Hz'; el('Cents').textContent = '—';
    el('Detected').textContent = '等待单音'; el('Needle').hidden = true;
    el('Meter').dataset.state = 'idle';
  }
  function controls() {
    for (const id of ['tuner', 'erhuTuner']) {
      $(id + 'Mic').textContent = starting ? '取消启动' : running ? '停止收音' : '开始调音';
      $(id + 'Mic').setAttribute('aria-pressed', String(running));
    }
    for (const [id, value] of [['guitarManualMode', 'manual'], ['guitarAutoMode', 'auto'], ['guitarFreeMode', 'free']]) {
      $(id).setAttribute('aria-pressed', String(mode === value));
    }
    $('tunerFreeTargetWrap').hidden = mode !== 'free';
  }
  function setTarget(item) {
    target = item;
    tracker.reset(); candidate = null;
    el('Note').textContent = item.note;
    el('String').textContent = item.label || '固定目标';
    el('Target').textContent = '目标 ' + E.frequency(item.midi, reference).toFixed(2) + ' Hz';
    window.dispatchEvent(new CustomEvent('haitang:tuner-target', { detail: { note: item.note, instrument: page } }));
    document.querySelectorAll('#guitar [data-tune]').forEach(button => button.setAttribute('aria-pressed', String(page === 'guitar' && mode !== 'free' && button.dataset.note === item.note)));
    document.querySelectorAll('#erhu [data-erhu-string]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.note === item.note)));
    clearReading();
    if (running) status('请只弹一根弦，等待声音稳定');
  }
  function stopTone() { toneGeneration++; clearTimeout(toneTimer); if (oscillator) { try { oscillator.stop(); } catch (_) {} oscillator.disconnect(); oscillator = null; } }
  function stop() {
    window.dispatchEvent(new CustomEvent('haitang:tuner-attempt', { detail: { phase: 'end' } }));
    generation++; running = false; starting = false;
    cancelAnimationFrame(raf); raf = 0; input.stop(); tracker.reset(); stopTone(); candidate = null;
    clearReading(); el('Level').value = 0; status('收音已停止'); controls();
    if (window.HetianCore?.state?.get('audio.inputOwner') === 'tuner') window.HetianCore.state.patch('audio', { inputOwner: '' }, { source: 'tuner' });
  }
  function errorText(error) {
    if (/NotAllowed|Security/.test(error.name || '')) return '麦克风未获授权。请在浏览器或系统设置中允许麦克风，再点“开始调音”。';
    if (/NotFound/.test(error.name || '')) return '未找到麦克风，请检查设备连接后重试。';
    if (/NotReadable/.test(error.name || '')) return '麦克风被占用或不可用，请关闭其他录音应用后重试。';
    return error.message || '收音启动失败，请重试。';
  }
  async function start() {
    if (running || starting) return;
    stopTone();
    window.HetianApp?.stopAllAudio?.('tuner-start');
    window.HetianCore?.audio?.claimInput('tuner');
    const request = ++generation;
    starting = true; window.dispatchEvent(new CustomEvent('haitang:tuner-attempt', { detail: { phase: 'begin', instrument: page } })); status('正在开启麦克风…'); controls();
    try {
      await input.start();
      if (request !== generation) return;
      detector = new root.YinPitchDetector(input.sampleRate, E.CONFIG);
      buffer = new Float32Array(E.CONFIG.fftSize);
      window.dispatchEvent(new CustomEvent('haitang:tuner-attempt', { detail: { phase: 'started' } }));
      running = true; starting = false; lastFrame = 0; tracker.reset();
      for (const track of input.stream?.getAudioTracks() || []) track.addEventListener('ended', () => { if (running) { stop(); status('麦克风已断开，请重新开始'); } }, { once:true });
      status('正在听，请只弹一根弦'); controls(); raf = requestAnimationFrame(loop);
    } catch (error) {
      if (request !== generation) return;
      const failure = /NotAllowed|Security/.test(error.name || '') ? 'permission' : /NotFound/.test(error.name || '') ? 'no_device' : /NotReadable/.test(error.name || '') ? 'device_busy' : /NotSupported/.test(error.name || '') ? 'unsupported' : 'unknown';
      window.dispatchEvent(new CustomEvent('haitang:tuner-attempt', { detail: { phase: 'failed', failure } }));
      stop(); status(errorText(error), 'error');
    }
  }
  function autoSelect(result, now) {
    if (mode !== 'auto' || page !== 'guitar') return;
    if (!result.frequency || result.confidence < .9 || result.db < E.CONFIG.releaseDb || result.peak >= .98) { candidate = null; return; }
    const best = strings.reduce((a, b) => Math.abs(E.cents(result.frequency, E.frequency(a.midi, reference))) < Math.abs(E.cents(result.frequency, E.frequency(b.midi, reference))) ? a : b);
    if (Math.abs(E.cents(result.frequency, E.frequency(best.midi, reference))) > 150) { candidate = null; return; }
    if (candidate !== best.note) { candidate = best.note; candidateSince = now; }
    if (now - candidateSince >= 180 && target.note !== best.note) setTarget(best);
  }
  function loop(now) {
    if (!running || !input.analyser) return;
    raf = requestAnimationFrame(loop);
    if (now - lastFrame < 55) return;
    lastFrame = now;
    try { input.analyser.getFloatTimeDomainData(buffer); }
    catch (error) { stop(); status(errorText(error), 'error'); return; }
    const result = detector.detect(buffer);
    autoSelect(result, now);
    const reading = tracker.update(result, E.frequency(target.midi, reference), now);
    el('Level').value = Math.max(0, Math.min(100, (result.db + 70) / 65 * 100));
    if (!reading.frequency || reading.state === 'wrong-note') {
      clearReading();
      if (reading.state === 'wrong-note') {
        const midi = Math.round(69 + 12 * Math.log2(reading.frequency / reference));
        el('Detected').textContent = '听到 ' + E.noteName(midi);
      }
      status(({ quiet:'声音较轻，请靠近麦克风并弹一根弦', unclear:'声音不稳定，请止住其他弦后再弹', clipping:'声音过大，请稍远离麦克风', acquiring:'正在确认音高…', 'wrong-note':'与目标音相差较大，请核对琴弦和八度' })[reading.state]);
      return;
    }
    const midi = Math.round(69 + 12 * Math.log2(reading.frequency / reference));
    window.dispatchEvent(new CustomEvent('haitang:tuner-reading', { detail: { note: target.note, instrument: page, cents: reading.cents, stable: reading.stable, at: now } }));
    el('Freq').textContent = reading.frequency.toFixed(1) + ' Hz';
    el('Detected').textContent = '听到 ' + E.noteName(midi);
    const rounded = Math.round(reading.cents);
    el('Cents').textContent = (rounded > 0 ? '+' : '') + rounded;
    el('Needle').hidden = false;
    el('Needle').style.left = (50 + Math.max(-50, Math.min(50, reading.cents))) + '%';
    el('Meter').dataset.state = reading.state;
    status(reading.stable ? '✓ 已调准，音高稳定' : reading.state === 'settling' ? '接近准确，请保持…' : reading.cents < 0 ? '偏低 · 缓慢调高' : '偏高 · 缓慢调低', reading.stable ? 'intune' : '');
  }
  async function referenceTone() {
    stop();
    const token = toneGeneration;
    try {
      const context = window.HetianCore.audio.getContext();
      await context.resume();
      if (token !== toneGeneration) return;
      const osc = context.createOscillator(), gain = context.createGain();
      oscillator = osc; osc.frequency.value = E.frequency(target.midi, reference);
      gain.gain.setValueAtTime(0, context.currentTime);
      gain.gain.linearRampToValueAtTime(.12, context.currentTime + .04);
      gain.gain.setTargetAtTime(0, context.currentTime + 1.25, .06);
      osc.connect(gain); gain.connect(context.destination);
      osc.onended = () => gain.disconnect();
      osc.start(); osc.stop(context.currentTime + 1.6);
      status('参考音播放中，收音已暂停');
      toneTimer = setTimeout(() => { if (token === toneGeneration) { stopTone(); status('参考音结束，点“开始调音”继续'); } }, 1700);
    } catch (error) { if (token === toneGeneration) status(errorText(error), 'error'); }
  }
  function switchMode(next) {
    stopTone(); mode = next; controls();
    if (mode === 'free') applyFree(); else setTarget(strings.find(item => item.note === read('jadeTunerLastTarget', 'E2')) || strings[0]);
  }
  function applyFree() {
    const field = $('tunerFreeTarget'), parsed = E.parseTarget(field.value, reference);
    field.setAttribute('aria-invalid', String(!parsed));
    $('tunerFreeError').textContent = parsed ? '' : '请输入 C2–C6 的目标音，例如 E2、D2、F#3 或 Bb2';
    if (!parsed) return;
    save('jadeTunerFreeTarget', parsed.note); field.value = parsed.note; setTarget({ ...parsed, label:'自定目标 · 不随声音改变' });
  }
  for (const id of ['tuner', 'erhuTuner']) {
    $(id + 'Mic').onclick = () => running || starting ? stop() : start();
    $(id + 'Tone').onclick = referenceTone;
    $(id + 'Reference').value = reference;
    $(id + 'Reference').onchange = event => {
      const value = Number(event.target.value);
      if (!Number.isFinite(value) || value < 430 || value > 450) { event.target.value = reference; status('标准音范围为 A4 = 430–450 Hz'); return; }
      stopTone(); reference = value; save('haitangTunerReference', reference);
      $('tunerReference').value = $('erhuTunerReference').value = reference; setTarget(target);
    };
  }
  $('guitarManualMode').onclick = () => switchMode('manual');
  $('guitarAutoMode').onclick = () => switchMode('auto');
  $('guitarFreeMode').onclick = () => switchMode('free');
  $('tunerFreeTarget').value = E.parseTarget(read('jadeTunerFreeTarget', 'E2'))?.note || 'E2';
  $('tunerFreeTarget').onchange = applyFree;
  $('tunerFreeTarget').onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); applyFree(); } };
  document.querySelectorAll('#guitar [data-tune]').forEach(button => button.onclick = () => {
    stopTone(); mode = 'manual'; controls(); const item = strings.find(item => item.note === button.dataset.note);
    save('jadeTunerLastTarget', item.note); setTarget(item);
  });
  function erhuPreset(notes) {
    erhuNotes = notes;
    document.querySelectorAll('#erhu [data-erhu]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.erhu === notes.join(','))));
    ['erhuInner', 'erhuOuter'].forEach((id, index) => { $(id).dataset.note = notes[index]; $(id).textContent = (index ? '外弦 ' : '内弦 ') + notes[index]; });
    if (page === 'erhu') setTarget({ ...E.parseTarget(notes[0], reference), label:'内弦' });
  }
  document.querySelectorAll('#erhu [data-erhu]').forEach(button => button.onclick = () => { stopTone(); erhuPreset(button.dataset.erhu.split(',')); });
  ['erhuInner', 'erhuOuter'].forEach((id, index) => $(id).onclick = () => { stopTone(); setTarget({ ...E.parseTarget(erhuNotes[index], reference), label:index ? '外弦' : '内弦' }); });
  window.addEventListener('musictoolbox:pagechange', event => {
    stop();
    if (!['guitar', 'erhu'].includes(event.detail.id)) return;
    page = event.detail.id;
    if (page === 'guitar') switchMode(mode); else erhuPreset(erhuNotes);
    status('先选目标音，再点“开始调音”');
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);
  window.HetianCore?.audio?.registerStopper('tuner', stop);
  root.tuner = { stop, getTarget: () => ({ note: target.note, reference, instrument: page }),
    selectTarget(note, instrument = 'guitar') {
      const parsed = E.parseTarget(note, reference); if (!parsed) return false;
      stop(); page = instrument === 'erhu' ? 'erhu' : 'guitar';
      if (page === 'guitar') {
        const string = strings.find(item => item.note === parsed.note);
        mode = string ? 'manual' : 'free'; controls();
        if (!string) { $('tunerFreeTarget').value = parsed.note; applyFree(); } else setTarget(string);
      } else setTarget({ ...parsed, label: '固定目标' });
      status('目标已设定，点“开始调音”'); return true;
    }
  };
  erhuPreset(erhuNotes); setTarget(strings.find(item => item.note === read('jadeTunerLastTarget', 'E2')) || strings[0]); controls();
})();
