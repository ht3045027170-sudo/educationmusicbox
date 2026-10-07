(() => {
  'use strict';
  const inputs=[...document.querySelectorAll('[data-tuner-experience-consent]')],key='haitangTunerExperienceConsent';
  let enabled=false,attempt=null;const pending=new Set();
  try{enabled=localStorage.getItem(key)==='yes'}catch(_){}
  const platform=()=> /Android/i.test(navigator.userAgent)?'android':/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)?'ios':/Windows|Macintosh|Linux/i.test(navigator.userAgent)?'desktop':'other';
  const browser=()=> /Edg|EdgiOS|EdgA\//i.test(navigator.userAgent)?'edge':/Firefox|FxiOS/i.test(navigator.userAgent)?'firefox':/Chrome|CriOS/i.test(navigator.userAgent)?'chrome':/Safari/i.test(navigator.userAgent)?'safari':'other';
  inputs.forEach(input=>{input.checked=enabled;input.onchange=()=>{
    enabled=input.checked;try{localStorage.setItem(key,enabled?'yes':'no')}catch(_){}
    inputs.forEach(other=>other.checked=enabled);
    if(!enabled){attempt=null;pending.forEach(controller=>controller.abort());pending.clear()}
  }});
  window.addEventListener('haitang:tuner-attempt',event=>{
    const detail=event.detail;
    if(detail.phase==='begin'){attempt=enabled?{instrument:detail.instrument,started:false,stable:false,failure:'none'}:null;return}
    if(!enabled||!attempt)return;
    if(detail.phase==='started')attempt.started=true;
    if(detail.phase==='failed')attempt.failure=detail.failure;
    if(detail.phase!=='end')return;
    const record=attempt;attempt=null;
    const controller=new AbortController();pending.add(controller);
    const result=record.failure!=='none'?'input_failed':!record.started?'cancelled':record.stable?'stable':'no_stable';
    fetch('/api/tuner-experience',{method:'POST',credentials:'omit',referrerPolicy:'no-referrer',keepalive:true,signal:controller.signal,headers:{'content-type':'application/json'},body:JSON.stringify({consent:true,platform:platform(),browser:browser(),instrument:record.instrument,result,failure:record.failure})}).catch(()=>{}).finally(()=>pending.delete(controller));
  });
  window.addEventListener('haitang:tuner-reading',event=>{if(enabled&&attempt&&event.detail.stable===true)attempt.stable=true});
})();
