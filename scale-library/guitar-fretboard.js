((build) => {
  if (typeof module === 'object' && module.exports) module.exports = build();
  else window.HetianGuitarFretboard = build();
})(() => {
  'use strict';

  const inlays = new Set([3,5,7,9,12,15,17,19,21,24]);
  const stringWeights = [.75,.9,1.05,1.25,1.55,1.9];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, symbol =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[symbol]);

  function geometry(region, {orientation, mirror} = {}) {
    const strings = [...new Set(region.cells.map(cell => cell.string))].sort((a,b) => a-b);
    const vertical = orientation === 'vertical';
    // A conventional vertical guitar chart has the low string at the left.
    if (vertical !== Boolean(mirror)) strings.reverse();
    const count = region.to - region.from + 1;
    const along = fret => 30 + (fret - region.from) * 38;
    const across = index => 29 + index * 29;
    const point = (fret,index) => vertical ? [across(index),along(fret)] : [along(fret),across(index)];
    const longitudinal = along(region.to) + 24;
    const lateral = across(strings.length-1) + 20;
    return { strings, count, vertical, along, across, point,
      width:vertical ? lateral : longitudinal, height:vertical ? longitudinal : lateral };
  }

  function render(region, options, decorate) {
    const {strings,count,vertical,point,width,height,across} = geometry(region,options);
    const {from,to} = region;
    const frets = Array.from({length:count}, (_,index)=>from+index);
    const line = ([x1,y1],[x2,y2],style,width) =>
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${style}" stroke-width="${width}"/>`;
    const text = ([x,y],value,style) => `<text x="${x}" y="${y}" class="${style}" dy=".34em">${escape(value)}</text>`;
    const dot = ([x,y],radius,style) => `<circle cx="${x}" cy="${y}" r="${radius}" class="${style}"/>`;
    const edges = fret => vertical ? [[14,point(fret,0)[1]],[width-6,point(fret,0)[1]]] :
      [[point(fret,0)[0],15],[point(fret,0)[0],height-7]];
    const inset = (fret,offset) => vertical ? [across((strings.length-1)/2)+offset,point(fret,0)[1]] :
      [point(fret,0)[0],across((strings.length-1)/2)+offset];
    const firstWire = from === 0 ? .5 : from-.5;
    const marks = options.inlays && strings.length > 1 ? frets.filter(fret=>inlays.has(fret)).map(fret =>
      fret % 12 === 0 ? dot(inset(fret,-29),3.6,'gf-inlay')+dot(inset(fret,29),3.6,'gf-inlay') :
        dot(inset(fret,0),3.6,'gf-inlay')).join('') : '';
    const wire = (fret, nut = false) => line(...edges(fret),nut?'gf-nut':'gf-wire',nut?3.5:1.2);
    const stringLines = strings.map((string,index) => line(point(Math.max(0,from-.5),index),
      point(to+.5,index),'gf-string',stringWeights[string-1])).join('');
    const axes = strings.map((string,index) => text(vertical?[across(index),7]:[6,across(index)],
      string,'gf-axis')).join('') + frets.map(fret=>text(vertical?[5,point(fret,0)[1]]:[point(fret,0)[0],7],
      fret,'gf-axis')).join('');
    const buttons = region.cells.map(cell => {
      const index = strings.indexOf(cell.string);
      const [x,y] = point(cell.fret,index);
      const {action,label,name,tone,root,marked,picked,finger} = decorate(cell);
      if (!action) return '';
      return `<g class="gf-hit ${tone || ''} ${picked ? 'gf-picked' : ''} ${marked ? 'gf-shared' : ''}"
        role="button" tabindex="0" data-ss-action="${escape(action)}" data-value="${cell.string}:${cell.fret}"
        aria-label="${escape(name)}"${options.quiz ? ` aria-pressed="${!!picked}"` : ''} transform="translate(${x} ${y})">
        <rect class="gf-touch" x="${vertical?-14.5:-19}" y="${vertical?-19:-14.5}" width="${vertical?29:38}" height="${vertical?38:29}" rx="5"/>
        ${tone || picked ? dot([0,0],11.8,'gf-note') : ''}
        ${root ? dot([0,0],14,'gf-ring') : ''}${marked ? dot([0,0],13.5,'gf-common') : ''}
        ${label ? text([0,finger ? -3 : 0],label,'gf-label') : ''}
        ${finger ? text([0,7],finger,'gf-finger') : ''}
      </g>`;
    }).join('');
    const long = !vertical && count > 7;
    return `<div class="gf-frame${long?' gf-long':''}"><svg class="gf-board${vertical?' gf-vertical':''}" viewBox="0 0 ${width} ${height}"
      width="${width}" height="${height}" style="--gf-min:${long?width*.78:0}px"
      role="group" aria-label="${escape(region.label)} · ${vertical?'纵向':'横向'}指板">
      <g aria-hidden="true">${marks}${wire(firstWire,from===0)}${frets.filter(fret=>fret>0).map(fret=>wire(fret+.5)).join('')}
      ${stringLines}${axes}</g>${buttons}
    </svg></div>`;
  }
  return { geometry, render };
});
