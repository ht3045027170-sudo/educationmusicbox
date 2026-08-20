(() => {
  'use strict';
  const root = window.MusicVocal = window.MusicVocal || {};
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  function errorMessage(error) {
    const name = error?.name || '';
    const raw = String(error?.message || '');
    if (!window.isSecureContext && !window.AndroidAudio) return '麦克风只能在 HTTPS、localhost 或安装版软件中使用。';
    if (/NotAllowed|Security/.test(name)) return '麦克风权限被拒绝，请在系统设置中允许本应用使用麦克风。';
    if (/NotFound|DevicesNotFound/.test(name)) return '没有找到麦克风，请检查设备连接。';
    if (/NotReadable|Abort/.test(name) || /audio source|track start/i.test(raw)) {
      return '麦克风录音源启动失败。安卓安装版会自动尝试原生录音通道；网页版请关闭占用麦克风的软件后重试。';
    }
    return raw ? `麦克风启动失败：${raw}` : '麦克风启动失败。';
  }

  class NativePcmAnalyser {
    constructor(bridge, fftSize) {
      this.bridge = bridge;
      this.fftSize = fftSize;
      this.smoothingTimeConstant = 0;
      this.last = new Float32Array(fftSize);
    }
    getFloatTimeDomainData(target) {
      let encoded = '';
      try { encoded = this.bridge.readPcmBase64() || ''; } catch (_) {}
      if (!encoded) {
        target.set(this.last.subarray(0, target.length));
        return;
      }
      try {
        const bytes = atob(encoded);
        const count = Math.min(target.length, Math.floor(bytes.length / 2));
        target.fill(0);
        const offset = target.length - count;
        const sourceOffset = Math.max(0, Math.floor(bytes.length / 2) - count);
        for (let i = 0; i < count; i++) {
          const p = (sourceOffset + i) * 2;
          let value = bytes.charCodeAt(p) | (bytes.charCodeAt(p + 1) << 8);
          if (value & 0x8000) value -= 0x10000;
          target[offset + i] = value / 32768;
        }
        this.last.set(target);
      } catch (_) {
        target.set(this.last.subarray(0, target.length));
      }
    }
    disconnect() {}
  }

  class AudioInputManager extends EventTarget {
    constructor(config = root.CONFIG) {
      super();
      this.config = config;
      this.context = null;
      this.stream = null;
      this.nodes = [];
      this.analyser = null;
      this.sampleRate = 48000;
      this.owner = '';
      this.nativeMode = false;
      this.startPromise = null;
      this.nativeGetUserMedia = navigator.mediaDevices?.getUserMedia
        ? navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
        : null;
    }
    supported() {
      return Boolean((this.nativeGetUserMedia && (window.AudioContext || window.webkitAudioContext)) ||
        window.AndroidAudio?.startCapture);
    }
    async prepareAndroidPermission() {
      const bridge = window.AndroidAudio;
      if (!bridge?.hasPermission || !bridge?.requestPermission) return;
      if (bridge.hasPermission()) return;
      bridge.requestPermission();
      const started = performance.now();
      while (performance.now() - started < 12000) {
        await wait(180);
        if (bridge.hasPermission()) return;
      }
      const error = new Error('Android microphone permission denied');
      error.name = 'NotAllowedError';
      throw error;
    }
    async getContext() {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return null;
      if (!this.context || this.context.state === 'closed') this.context = window.HetianCore?.audio?.getContext?.() || new Context();
      if (this.context.state === 'suspended') await this.context.resume();
      return this.context;
    }
    async requestStream() {
      if (!this.nativeGetUserMedia) throw Object.assign(new Error('浏览器不支持网页麦克风'), { name: 'NotSupportedError' });
      const preferred = { audio: {
        channelCount: { ideal: 1 }, sampleRate: { ideal: 48000 },
        echoCancellation: { ideal: false }, noiseSuppression: { ideal: false },
        autoGainControl: { ideal: false }
      }};
      try { return await this.nativeGetUserMedia(preferred); }
      catch (first) {
        if (!/NotReadable|Overconstrained|Abort/.test(first?.name || '') &&
          !/audio source/i.test(first?.message || '')) throw first;
        await wait(300);
        return this.nativeGetUserMedia({ audio: true });
      }
    }
    async start(owner = 'vocal-pitch') {
      if (this.startPromise) return this.startPromise;
      this.startPromise = this.startInternal(owner).finally(() => { this.startPromise = null; });
      return this.startPromise;
    }
    async startInternal(owner) {
      window.HetianCore?.audio?.claimInput?.(owner);
      await this.stop();
      window.HetianCore?.audio?.claimInput?.(owner);
      await this.prepareAndroidPermission();
      const context = await this.getContext();
      let webError = null;
      if (context && this.nativeGetUserMedia) {
        try {
          const stream = await this.requestStream();
          const source = context.createMediaStreamSource(stream);
          const highPass = context.createBiquadFilter();
          const lowPass = context.createBiquadFilter();
          const analyser = context.createAnalyser();
          highPass.type = 'highpass'; highPass.frequency.value = this.config.analysisMinFrequency;
          lowPass.type = 'lowpass'; lowPass.frequency.value = this.config.analysisMaxFrequency;
          analyser.fftSize = this.config.fftSize; analyser.smoothingTimeConstant = 0;
          source.connect(highPass); highPass.connect(lowPass); lowPass.connect(analyser);
          this.stream = stream; this.nodes = [source, highPass, lowPass]; this.analyser = analyser;
          this.sampleRate = context.sampleRate; this.owner = owner; this.nativeMode = false;
          this.dispatchEvent(new CustomEvent('started', { detail: { owner, native: false } }));
          return { context, stream, analyser, sampleRate: this.sampleRate, native: false };
        } catch (error) { webError = error; }
      }
      const bridge = window.AndroidAudio;
      if (bridge?.startCapture) {
        let started = false;
        try { started = bridge.startCapture(); } catch (_) {}
        if (started) {
          const sampleRate = Number(bridge.getSampleRate?.()) || 48000;
          const analyser = new NativePcmAnalyser(bridge, this.config.fftSize);
          this.analyser = analyser; this.sampleRate = sampleRate; this.owner = owner; this.nativeMode = true;
          this.dispatchEvent(new CustomEvent('started', { detail: { owner, native: true } }));
          return { context, stream: null, analyser, sampleRate, native: true };
        }
      }
      throw webError || Object.assign(new Error('当前平台无法启动音频输入'), { name: 'NotReadableError' });
    }
    async stop(owner = '') {
      if (owner && this.owner && owner !== this.owner) return;
      const releasedOwner = this.owner;
      this.nodes.forEach(node => { try { node.disconnect(); } catch (_) {} });
      if (this.analyser) { try { this.analyser.disconnect(); } catch (_) {} }
      if (this.stream) this.stream.getTracks().forEach(track => track.stop());
      if (this.nativeMode) { try { window.AndroidAudio?.stopCapture?.(); } catch (_) {} }
      this.stream = null; this.nodes = []; this.analyser = null; this.owner = ''; this.nativeMode = false;
      if (releasedOwner && window.HetianCore?.state?.get('audio.inputOwner') === releasedOwner) {
        window.HetianCore.state.patch('audio', { inputOwner: '' }, { source: 'vocal-pitch' });
      }
      this.dispatchEvent(new Event('stopped'));
    }
    stopAll() { return this.stop(); }
  }

  root.NativePcmAnalyser = NativePcmAnalyser;
  root.AudioInputManager = AudioInputManager;
  root.audioInputManager = root.audioInputManager || new AudioInputManager();
  root.audioErrorMessage = errorMessage;
})();
