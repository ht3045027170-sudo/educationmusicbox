const assert = require('node:assert/strict');
const fs = require('node:fs');
const H = require('../chord-library/harmony.js');
const S = require('../scale-library/scales.js');
const I = require('../scale-library/instrument.js');
const GuitarFretboard = require('../scale-library/guitar-fretboard.js');

const names = keys => keys.map(note => note.name);
const tones = (key,id,descending) => S.tones(H.readRoot(key),S.byId.get(id),descending);
const formulas = {
  major:[0,2,4,5,7,9,11], minor:[0,2,3,5,7,8,10], dorian:[0,2,3,5,7,9,10],
  'harmonic-minor':[0,2,3,5,7,8,11], 'jazz-minor':[0,2,3,5,7,9,11],
  'phrygian-dom':[0,1,4,5,7,8,10], altered:[0,1,3,4,6,8,10],
  'major-pent':[0,2,4,7,9], 'minor-pent':[0,3,5,7,10],
  'major-blues':[0,2,3,4,7,9], 'minor-blues':[0,3,5,6,7,10],
};
for (const [id,pitches] of Object.entries(formulas)) assert.deepEqual(S.byId.get(id).pitches,pitches,id);
assert.equal(S.collection.length,64);
assert.equal(new Set(S.collection.map(scale=>scale.id)).size,64);
assert.deepEqual(I.open,[40,45,50,55,59,64]);
assert.deepEqual(names(tones('A','minor')),['A','B','C','D','E','F','G']);
assert.deepEqual(names(tones('G♭','major')),['G♭','A♭','B♭','C♭','D♭','E♭','F']);
assert.deepEqual(names(tones('F♯','major')),['F♯','G♯','A♯','B','C♯','D♯','E♯']);
assert.deepEqual(names(tones('A','classical-minor',true)),names(tones('A','minor')));
assert.deepEqual(names(tones('A','classical-minor')),names(tones('A','jazz-minor')));
assert.equal(S.find('Ionian').id,'major');

let cellsChecked = 0;
for (const scale of S.collection) {
  assert.equal(scale.pitches[0],0,scale.id);
  assert.ok(scale.pitches.every((pc,i)=>pc<12 && (i===0 || pc>scale.pitches[i-1])),scale.id);
  for (const rootName of H.keys) {
    const root = H.readRoot(rootName);
    const notes = S.tones(root,scale);
    for (const [index,note] of notes.entries()) {
      assert.equal(H.readRoot(note.name).pc,note.pc,note.name);
      assert.equal(S.mod(H.semitones(note.interval)),scale.pitches[index],scale.id);
      assert.equal(note.pc,S.mod(root.pc+scale.pitches[index]));
    }
    const cells = I.board(notes);
    assert.equal(cells.length,150);
    for (const cell of cells) {
      const midi = [64,59,55,50,45,40][cell.string-1]+cell.fret;
      assert.equal(cell.midi,midi);
      assert.equal(cell.tone?.pc,notes.find(note=>note.pc===midi%12)?.pc);
      cellsChecked++;
    }
    for (const count of [2,3]) {
      for (const shape of I.perString(notes,count)) {
        const sounding=shape.cells.filter(cell=>cell.tone);
        assert.equal(sounding.length,count*6);
        assert.ok(sounding.every((note,i)=>i===0||sounding[i-1].midi<note.midi));
      }
    }
    if (['major-pent','minor-pent'].includes(scale.id)) {
      const boxes=I.caged(root,notes);
      assert.equal(boxes.length,5);
      boxes.forEach(box=>assert.equal(box.cells.filter(cell=>cell.tone).length,12));
      for (let i=1;i<boxes.length;i++) assert.ok(I.overlap(boxes[i-1],boxes[i]).length);
    }
  }
}
for (const key of H.keys) for (const type of H.types.values()) {
  const root=H.readRoot(key), notes=I.material(root,type);
  for (const note of notes) assert.equal(H.readRoot(note.name).pc,note.pc);
  if (type.id==='7alt') assert.deepEqual(notes.map(note=>note.interval),['1','3','b5','b7','#9']);
  else assert.equal(notes.length,type.tones.length);
}
const tab = I.parseTab('3:5h(7)@1 2:8b(10) r@1 1:8~ 1:8p(5) 2:8/(10) 2:10\\(8)');
assert.deepEqual(I.parseTab(I.formatTab(tab)),tab);
for (const shift of [-3,0,2,12]) {
  const moved=I.relocate(tab,shift,8);
  moved.forEach((note,i)=>{
    if (note.rest) return assert.deepEqual(note,tab[i]);
    assert.equal(note.midi,tab[i].midi+shift);
    assert.equal(note.technique,tab[i].technique);
    assert.equal(note.targetFret === null ? null : note.targetFret-note.fret,
      tab[i].targetFret === null ? null : tab[i].targetFret-tab[i].fret);
  });
}
assert.throws(()=>I.parseTab('1:8h(5)'));
const start=1e9;
const first=I.review(null,true,start);
assert.ok(I.review(first,true,start).due>first.due);
assert.ok(I.review(first,false,start).due<first.due);
const tonic=H.readRoot('C');
const chords=H.parse('Dm7 G7 Cmaj7',tonic,'major').map(item=>H.resolve(item,tonic,'major'));
assert.ok(I.compatible(chords[0],tonic,'major').some(({scale,exact})=>scale.id==='dorian'&&exact));
assert.ok(I.compatible(chords[1],tonic,'major').some(({scale,exact})=>scale.id==='mixolydian'&&exact));
assert.ok(I.nearestTargets(60,chords[2],5,9));
for (const file of ['index.html','product-entry.js']) assert.doesNotMatch(fs.readFileSync(file,'utf8'),/showExamLogin|id="gaokaoLogin"/);
console.log(`Scale studio: ${S.collection.length} scales × ${H.keys.length} keys, ${cellsChecked} fret positions, ${H.types.size} chord types × ${H.keys.length} keys, exact TAB transposition and review scheduling.`);

const aBlues = H.readRoot('A');
const bluesBoxes = I.caged(aBlues,tones('A','minor-blues'));
const eShape = bluesBoxes.find(box=>box.label==='E 型');
assert.deepEqual([eShape.from,eShape.to],[5,8]);
const examples = {'6:5':'1','6:8':'b3','5:6':'b5','5:7':'5','4:7':'1','3:8':'b5','1:5':'1','1:8':'b3'};
for (const [position,interval] of Object.entries(examples)) {
  const cell=eShape.cells.find(note=>I.key(note)===position);
  assert.equal(cell.tone.interval,interval,position);
  assert.equal(cell.midi,I.coordinate(...position.split(':').map(Number)).midi);
}
assert.equal(new Set(eShape.skeleton.map(cell=>cell.tone.pc)).size,3);
assert.deepEqual(I.overlap(eShape,bluesBoxes[1]).map(I.key),
  eShape.cells.filter(note=>note.tone&&bluesBoxes[1].cells.some(other=>other.tone&&I.key(note)===I.key(other))).map(I.key));
const svg = (region,options) => GuitarFretboard.render(region,options,cell=>({
  action:cell.tone?'point':'',tone:cell.tone?'other':'',label:cell.tone?.interval,
}));
const strings = GuitarFretboard.geometry(eShape);
assert.deepEqual(strings.strings,[1,2,3,4,5,6]);
assert.ok(strings.point(5,0)[0]<strings.point(8,0)[0]);
assert.deepEqual(GuitarFretboard.geometry(eShape,{mirror:true}).strings,[6,5,4,3,2,1]);
assert.deepEqual(GuitarFretboard.geometry(eShape,{orientation:'vertical'}).strings,[6,5,4,3,2,1]);
for (const options of [{},{orientation:'vertical'},{mirror:true},{orientation:'vertical',mirror:true}]) {
  const rendered=svg(eShape,options);
  const buttons=[...rendered.matchAll(/data-value="(\d+:\d+)"/g)].map(match=>match[1]);
  assert.deepEqual(buttons,eShape.cells.filter(cell=>cell.tone).map(I.key));
}
const full = svg(I.region(tones('A','minor-blues'),0,24,'完整指板'),{inlays:true});
assert.equal((full.match(/class="gf-inlay"/g)||[]).length,12);
assert.equal((full.match(/class="gf-nut"/g)||[]).length,1);
assert.equal((full.match(/class="gf-string"/g)||[]).length,6);
console.log('SVG fretboard: A minor blues E shape, 8 reference positions, 4 view combinations, nut and 12 inlay dots.');
