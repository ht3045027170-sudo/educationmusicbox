((build) => {
  if (typeof module === 'object' && module.exports) module.exports = build(require('../chord-library/harmony.js'));
  else window.HetianScales = build(window.HetianChordLibrary);
})(harmony => {
  'use strict';
  // Formulas were checked against Tonal ScaleType and named variants are explicit.
  // Keep spelling/transposition in the same engine as the chord atlas.
  const mod = n => (n % 12 + 12) % 12;
  const degree = text => Number(text.match(/\d+/)[0]);
  const printable = harmony.suffixLabel;
  const natural = [0, 2, 4, 5, 7, 9, 11];
  const groups = {
    modes: ['自然大调调式', '流行 / 爵士 / 调式音乐', '先唱主音，保持低音持续，再弹特征音与三音。'],
    harmonic: ['和声小调调式', '古典 / 爵士 / 西班牙色彩', '慢弹含增二度的片段，听半音解决，不必平均使用所有音。'],
    melodic: ['爵士旋律小调调式', '现代爵士 / Fusion', '在一个和弦上持续低音，用特征音作弱拍经过或有意延长。'],
    pent: ['五声与 Blues', 'Blues / 流行 / Funk / 摇滚', '两小节问答，先只用三音，下一轮再加入特征音。'],
    bebop: ['Bebop', 'Bebop / Swing', '从和弦音起弹八分音符，检查顺序和起点能否让和弦音落在强拍。'],
    symmetric: ['对称与半音', '爵士 / 现代配乐', '把相邻两种步距组成一组，在两个八度内移位，并意识到落点。'],
    other: ['其他音阶', '调式创作 / 配乐', '用主音持续音作背景，比较特征音与常见音阶在半音位置上的差异。'],
  };
  const collection = [];
  function add(group, id, zh, en, formula, feature, chords, usage = '', aliases = '', relative = null) {
    const intervals = formula.split(' ');
    const pitches = intervals.map(harmony.semitones);
    if (pitches[0] !== 0 || pitches.some((pitch, i) => pitch >= 12 || (i && pitch <= pitches[i - 1]))) {
      throw Error('音阶公式错误 ' + id);
    }
    collection.push({ group, id, zh, en, intervals, pitches, feature: feature.split(' ').filter(Boolean),
      chords: chords.split(' '), usage: usage || '用主音或适用和弦作背景，再逐个检验色彩音。',
      aliases: aliases ? aliases.split('|') : [], relative });
  }

  function modes(group, parent, rows) {
    rows.forEach(([id, zh, en, feature, chords, usage, aliases], i) => {
      const rotated = [...parent.slice(i), ...parent.slice(0, i).map(n => n + 12)].map(n => n - parent[i]);
      const formula = rotated.map((n, j) => {
        const shift = n - natural[j];
        return (shift < 0 ? 'b'.repeat(-shift) : '#'.repeat(shift)) + (j + 1);
      });
      add(group, id, zh, en, formula.join(' '), feature, chords, usage, aliases,
        group === 'modes' ? { degree: (7 - i) % 7 + 1, pitch: mod(-parent[i]), mode: i } : null);
    });
  }

  modes('modes', natural, [
    ['major','自然大调 · 伊奥尼亚','Major / Ionian','7','maj7 maj9','主功能落向 1、3、7。4 与大三音同响会较紧。','自然大调|Ionian|大调'],
    ['dorian','多利亚','Dorian','6','m7 m9 m13','大调 ii 或小七持续和弦上，听大六音。'],
    ['phrygian','弗里几亚','Phrygian','b2','m7 sus4','小二音是主要色彩，通常作为经过或调式张力。'],
    ['lydian','利底亚','Lydian','#4','maj7 maj7#11','把升四作为 #11 着色，特别适合大七和弦。','Lydian|利迪亚'],
    ['mixolydian','混合利底亚','Mixolydian','b7','7 9 13','适用于大调 V7 或无强烈变化张力的属七。'],
    ['minor','自然小调 · 埃奥利亚','Natural Minor / Aeolian','b6 b7','m m7 m9','小调主和弦、或大调 vi 上使用，留意 ♭6 和五音的半音摩擦。','自然小调|Aeolian|纯小调'],
    ['locrian','洛克里亚','Locrian','b2 b5','m7b5','适合半减和弦，♭2 常用作经过音。'],
  ]);
  modes('harmonic', [0,2,3,5,7,8,11], [
    ['harmonic-minor','和声小调','Harmonic Minor','b6 7','m m(maj7)','突出导音解决，可用在同一小调的主属进行。'],
    ['locrian6','洛克里亚升六','Locrian ♮6','b2 6','m7b5','以半减和弦为基底，对比自然六音。'],
    ['ionian5','伊奥尼亚升五','Ionian ♯5','#5','aug maj7','用于含升五的增三色彩，听升五与大七。'],
    ['dorian4','多利亚升四','Dorian ♯4','#4 6','m7 m6','在小七上用升四作为旋律张力。','Ukrainian Dorian|Romanian minor'],
    ['phrygian-dom','弗里几亚属音阶','Phrygian Dominant','b2 3 b6','7 7b9 7b13','小调 V7 上最典型，例如 E7 解决到 Am。','Spanish Gypsy|弗里几亚大调'],
    ['lydian2','利底亚升二','Lydian ♯2','#2 #4','maj7 maj7#11','把升二和升四与大三音作对比。'],
    ['ultralocrian','超洛克里亚','Ultralocrian','b4 bb7','dim7','检查减七实际音集，必要时用等音重拼。','Super Locrian ♭♭7'],
  ]);
  modes('melodic', [0,2,3,5,7,9,11], [
    ['jazz-minor','爵士旋律小调','Jazz Melodic Minor','6 7','m6 m(maj7)','上下行同一套音，常用于小调主和弦。','Jazz Minor|Melodic Minor'],
    ['dorian-b2','多利亚降二','Dorian ♭2','b2 6','m7 7sus4','小七上比较自然六与降二，也可用于特定属挂留色彩。','Phrygian ♮6'],
    ['lydian-aug','利底亚增五','Lydian Augmented','#4 #5','aug maj7#11','大七增五色彩，线条突出升四与升五。'],
    ['lydian-dom','利底亚属音阶','Lydian Dominant','#4 b7','7 7#11 9#11','适用于 #11 属和弦及常见三全音替代，保留实际旋律音。','Overtone|Mixolydian ♯4'],
    ['mix-b6','混合利底亚降六','Mixolydian ♭6','3 b6','7 7b13','属七保留自然 9，引入 ♭13。','Hindu scale'],
    ['locrian2','洛克里亚升二','Locrian ♮2','2 b5','m7b5','半减和弦上用自然九音替代洛克里亚的 ♭9。','Half-diminished scale'],
    ['altered','变化属音阶','Altered Scale','b2 b3 b4 b5 b6','7alt 7b9 7#9','爵士旋律小调第七调式。拼写按调式；用作属七时 ♭4 等音为 3，♭3 等音为 ♯9，♭6 等音为 ♯5。','Super Locrian|变音音阶'],
  ]);
  add('melodic','classical-minor','传统旋律小调','Classical Melodic Minor','1 2 b3 4 5 6 7','6 7','m m(maj7)',
    '上行升六、升七，下行回自然小调。指板与公式可切换显示方向。');
  add('symmetric','chromatic','半音音阶','Chromatic','1 b2 2 b3 3 4 #4 5 b6 6 b7 7','b2 #4','',
    '十二个音都出现；练习时先选和弦目标音，再用半音趋近。这里采用固定相对度数拼写。');
  const rows = [
    ['pent','major-pent','大调五声音阶','Major Pentatonic','1 2 3 5 6','6',' 6 maj7','可用在主和弦上；和小调五声比较相对关系。'],
    ['pent','minor-pent','小调五声音阶','Minor Pentatonic','1 b3 4 5 b7','b3 b7','m m7','Blues 中也可叠在 I7 上，主动处理小三与大三。'],
    ['pent','major-blues','大调布鲁斯','Major Blues','1 2 b3 3 5 6','b3',' 6 7','短暂经过 ♭3 向 3 推或滑。'],
    ['pent','minor-blues','小调布鲁斯','Minor Blues','1 b3 4 b5 5 b7','b5','m m7 7','把 ♭5 作为蓝音向 4 或 5 解决。'],
    ['pent','dom-pent','属七五声音阶','Dominant Pentatonic','1 2 3 5 b7','3 b7','7 9','这里采用属七加自然九音的版本。'],
    ['pent','minor-six-pent','小六五声','Minor Six Pentatonic','1 b3 4 5 6','6','m6 m7','变化的小六色彩，听大六和小三的组合。'],
    ['pent','egyptian','埃及五声','Egyptian','1 2 4 5 b7','4 b7','sus4 7sus4','无三音，可在挂留伴奏上使用。'],
    ['pent','ritusen','律旋五声','Ritusen','1 2 4 5 6','4 6','sus4','用四音和六音营造开放音响。'],
    ['pent','lydian-pent','利底亚五声','Lydian Pentatonic','1 3 #4 5 7','#4 7','maj7#11','直接勾出大七升十一色彩。'],
    ['pent','ionian-pent','伊奥尼亚五声','Ionian Pentatonic','1 3 4 5 7','4 7','maj7','用四音解决到三音，留意两音摩擦。'],
    ['pent','kumoi','云井五声','Kumoi','1 2 b3 5 6','b3 6','m6','适合小六持续低音，比较平调子降六。'],
    ['bebop','bebop-major','大调 Bebop','Major Bebop','1 2 3 4 5 #5 6 7','#5','6 maj7','版本：大调在 5–6 之间加 ♯5。'],
    ['bebop','bebop-dom','属七 Bebop','Dominant Bebop','1 2 3 4 5 6 b7 7','7','7 9','版本：Mixolydian 加自然 7 经过音。'],
    ['bebop','bebop-dorian','多利亚 Bebop','Dorian Bebop','1 2 b3 3 4 5 6 b7','3','m7 m13','版本：Dorian 在 ♭3–4 之间加大三；另有加入自然七的用法。'],
    ['bebop','bebop-melodic','旋律小调 Bebop','Melodic Minor Bebop','1 2 b3 4 5 #5 6 7','#5','m6 m(maj7)','版本：爵士旋律小调在 5–6 之间加 ♯5。'],
    ['bebop','bebop-harmonic','和声小调 Bebop','Harmonic Minor Bebop','1 2 b3 4 5 b6 b7 7','b7','m m(maj7)','版本：和声小调在 ♭6–7 之间加 ♭7。'],
    ['bebop','bebop-locrian','洛克里亚 Bebop','Bebop Locrian','1 b2 b3 4 b5 5 b6 b7','5','m7b5','版本：洛克里亚加自然五音作经过音。'],
    ['symmetric','whole-tone','全音音阶','Whole Tone','1 2 3 #4 #5 b7','#4 #5','aug 7#5','适合增三与升五属七，结束时靠音程解决。'],
    ['symmetric','half-whole','半全减音阶','Half–Whole Diminished','1 b2 #2 3 #4 5 6 b7','b2 #2 #4','7b9 7#9','从半音开始，保留自然 5 和 13，常用于属七。'],
    ['symmetric','whole-half','全半减音阶','Whole–Half Diminished','1 2 b3 4 b5 b6 6 7','b5 6','dim7','从全音开始；6 与减七的 ♭♭7 等音。'],
    ['symmetric','augmented','增音阶','Augmented','1 #2 3 5 #5 7','#2 #5','aug','这里从增二度开始，与半音交替。'],
    ['symmetric','composite-blues','复合布鲁斯','Composite Blues','1 2 b3 3 4 b5 5 6 b7','b3 b5','7 m7','合用大、小布鲁斯口音，练习时明确三音的解决。'],
    ['other','hungarian-minor','匈牙利小调','Hungarian Minor','1 2 b3 #4 5 b6 7','#4 7','m m(maj7)','含两个增二度，慢速听辨升四。'],
    ['other','hungarian-major','匈牙利大调','Hungarian Major','1 #2 3 #4 5 6 b7','#2 #4','7 7#11','属七上对比升二和升四。'],
    ['other','double-harmonic','双和声大调','Double Harmonic Major','1 b2 3 4 5 b6 7','b2 b6 7',' maj7','大三体系含两个增二度。','Byzantine'],
    ['other','neapolitan-major','那不勒斯大调','Neapolitan Major','1 b2 b3 4 5 6 7','b2 6','m(maj7)','这里名称指大六；第三音仍是小三。'],
    ['other','neapolitan-minor','那不勒斯小调','Neapolitan Minor','1 b2 b3 4 5 b6 7','b2 b6','m(maj7)','比较大调版本的第六音。'],
    ['other','persian','波斯音阶','Persian','1 b2 3 4 b5 b6 7','b5 b6 7','maj7b9','在核对实际伴奏音后使用，突出降五。'],
    ['other','hirajoshi','平调子','Hirajoshi','1 2 b3 5 b6','b3 b6','m','采用 1 2 ♭3 5 ♭6 版本，名称在不同来源间可能指不同转位。'],
    ['other','in-sen','阴旋法','In Sen','1 b2 4 5 b7','b2 4','sus4 7sus4','用小二与挂四营造张力。','In-Sen'],
    ['other','iwato','岩户音阶','Iwato','1 b2 4 b5 b7','b2 b5','m7b5','用持续主音表现降二和减五；完全伴奏需另外核对三音。'],
    ['other','harmonic-major','和声大调','Harmonic Major','1 2 3 4 5 b6 7','b6','maj7','和自然大调相比只降六音。'],
    ['other','oriental','东方音阶','Oriental','1 b2 3 4 b5 6 b7','b2 b5','7b5','双和声大调第五调式。'],
    ['other','enigmatic','谜之音阶','Enigmatic','1 b2 3 #4 #5 b7 7','b2 #4 #5','aug','以升四、升五强化不稳定色彩，两个七音不要同时压在强拍。'],
    ['other','prometheus','普罗米修斯音阶','Prometheus','1 2 3 #4 6 b7','#4 6','7#11','用六音和增四衔接到属七。'],
    ['other','lydian-b3','利底亚降三','Lydian Diminished','1 2 b3 #4 5 6 7','b3 #4','m(maj7)','比较爵士旋律小调，两者只差第四音。'],
    ['other','dorian-b5','多利亚降五','Dorian ♭5','1 2 b3 4 b5 6 b7','b5 6','m7b5','适合半减色彩，留意自然六。'],
    ['other','lydian-b7-b6','利底亚降六降七','Lydian Minor','1 2 3 #4 5 b6 b7','#4 b6','7#11 7b13','属七上把 ♯11 与 ♭13 当作两种可选张力。'],
    ['other','locrian-dom','洛克里亚属音阶','Locrian Dominant','1 b2 3 4 b5 b6 b7','3 b5','7b5','与弗里几亚属相比，五音降低。'],
    ['other','mix-b2','混合利底亚降二','Mixolydian ♭2','1 b2 3 4 5 6 b7','b2 6','7b9','和声大调第五调式，保留自然六。'],
    ['other','altered-bb3','变化音阶重降三','Altered ♭♭3','1 b2 bb3 b4 b5 b6 b7','bb3 b5','7alt','那不勒斯大调第七调式。用作属和弦时注意 ♭4 等音为大三。'],
  ];
  rows.forEach(row => add(...row));
  const byId = new Map(collection.map(scale => [scale.id, scale]));
  const relativePent = { 'major-pent': { degree: 1, pitch: 0, mode: 0 }, 'minor-pent': { degree: 3, pitch: 3, mode: 5 },
    'major-blues': { degree: 1, pitch: 0, mode: 0 }, 'minor-blues': { degree: 3, pitch: 3, mode: 5 } };
  const descending = (scale, down) => scale.id === 'classical-minor' && down ? byId.get('minor') : scale;
  function tones(root, scale, down = false) {
    scale = descending(scale, down);
    return scale.intervals.map((interval, i) => ({ interval, pc: mod(root.pc + scale.pitches[i]),
      pitch: scale.pitches[i], name: harmony.spell(root, interval), featured: scale.feature.includes(interval) }));
  }
  function relative(scale) {
    return scale.relative || relativePent[scale.id] || null;
  }
  function find(query) {
    const search = query.trim().toLowerCase();
    return collection.find(scale => [scale.id, scale.zh, scale.en, ...scale.aliases].some(value => value.toLowerCase() === search))
      || (search && collection.find(scale => [scale.zh,scale.en,...scale.aliases].some(value => value.toLowerCase().includes(search)))) || null;
  }
  const common = (a,b) => a.filter(note => b.some(other => other.pc === note.pc));
  const related = scale => collection.filter(other => other !== scale).map(other => ({
    scale: other, difference: scale.pitches.filter(n => !other.pitches.includes(n)).length +
      other.pitches.filter(n => !scale.pitches.includes(n)).length,
  })).sort((a,b) => a.difference - b.difference).slice(0, 2).map(match => match.scale);
  return { groups, collection, byId, mod, degree, printable, tones, relative, find, common, related, descending };
});
