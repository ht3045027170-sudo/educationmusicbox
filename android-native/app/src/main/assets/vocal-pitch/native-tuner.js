(() => {
  'use strict';
  const root = window.MusicVocal = window.MusicVocal || {};
  let raf = 0, running = false, analyser = null, detector = null, buffer = null;
  const $ = id => document.getElementById(id);
  function targetFrequency() {
    return Number(($('tunerTarget')?.textContent.match(/[\d.]+/) || [0])[0]) || 440;
  }
  function draw(cents) {
    const canvas=$('meterCanvas');if(!canvas)return;const x=canvas.getContext('2d'),W=canvas.width,H=canvas.height,cx=W/2,cy=H-14,r=165,center=Math.PI*1.5;
    x.clearRect(0,0,W,H);x.lineCap='round';
    const arc=(a,b,color,w)=>{x.beginPath();x.arc(cx,cy,r-6,a,b);x.strokeStyle=color;x.lineWidth=w;x.stroke()};
    arc(Math.PI+Math.PI/6,center-Math.PI/6,'#764b4b',12);arc(center-Math.PI/6,center+Math.PI/6,'#277b52',12);arc(center+Math.PI/6,2*Math.PI-Math.PI/6,'#764b4b',12);
    [-50,-25,0,25,50].forEach(value=>{const a=center+value/50*Math.PI/3;x.beginPath();x.moveTo(cx+(r-22)*Math.cos(a),cy+(r-22)*Math.sin(a));x.lineTo(cx+r*Math.cos(a),cy+r*Math.sin(a));x.strokeStyle='#8b9390';x.lineWidth=2;x.stroke();x.fillStyle='#838b87';x.font='11px system-ui';x.textAlign='center';x.fillText(value,cx+(r-37)*Math.cos(a),cy+(r-37)*Math.sin(a))});
    const a=center+Math.max(-1,Math.min(1,cents/50))*Math.PI/3;x.beginPath();x.moveTo(cx,cy);x.lineTo(cx+(r-18)*Math.cos(a),cy+(r-18)*Math.sin(a));x.strokeStyle='#ff6969';x.lineWidth=3;x.stroke();x.fillStyle='#55c889';x.font='bold 12px system-ui';x.fillText('准 IN TUNE',cx,20);
  }
  function stop() {
    running=false;cancelAnimationFrame(raf);raf=0;
    try { window.AndroidAudio?.stopCapture?.(); } catch (_) {}
  }
  function loop(now=performance.now()) {
    if(!running)return;raf=requestAnimationFrame(loop);analyser.getFloatTimeDomainData(buffer);
    const result=detector.detect(buffer);if(!result.frequency||result.confidence<.72)return;
    const target=targetFrequency(),cents=1200*Math.log2(result.frequency/target),midi=Math.round(69+12*Math.log2(result.frequency/440));
    $('tunerFreq').textContent=result.frequency.toFixed(1)+' Hz';
    const label=root.noteConverter.NOTE_NAMES[((midi%12)+12)%12]+(Math.floor(midi/12)-1);
    $('tunerDetected').textContent='检测音高：'+label+' · '+(cents>=0?'+':'')+cents.toFixed(0)+' 音分';
    $('tunerStatus').textContent=Math.abs(cents)<5?'✓ 音准正确':cents<0?'偏低 '+Math.abs(cents).toFixed(0)+' 音分':'偏高 '+Math.abs(cents).toFixed(0)+' 音分';
    $('tunerStatus').className='tuner-status '+(Math.abs(cents)<5?'intune':cents<0?'flat':'sharp');draw(cents);
  }
  function startNative(event) {
    const bridge=window.AndroidAudio;if(!bridge?.startCapture)return;
    event.preventDefault();event.stopImmediatePropagation();
    try {
      if(!bridge.hasPermission()){bridge.requestPermission();$('tunerStatus').textContent='正在申请麦克风权限，请允许后再点一次';return}
      if(!bridge.startCapture())throw new Error('原生录音源无法启动');
      const sampleRate=Number(bridge.getSampleRate())||48000;
      analyser=new root.NativePcmAnalyser(bridge,root.CONFIG.fftSize);detector=new root.YinPitchDetector(sampleRate,root.CONFIG);buffer=new Float32Array(root.CONFIG.fftSize);
      running=true;$('tunerEnableMicBtn').hidden=true;$('tunerStatus').textContent='安卓原生麦克风正在监听';loop();
    } catch(error) {$('tunerStatus').textContent='麦克风启动失败：'+error.message}
  }
  function init() {
    $('tunerEnableMicBtn')?.addEventListener('click',startNative,true);
    $('tunerClose')?.addEventListener('click',stop,true);
    window.addEventListener('pagehide',stop);
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();
