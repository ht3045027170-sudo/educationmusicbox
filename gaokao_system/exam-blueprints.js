(() => {
  'use strict';
  const blueprints = {
    guangdong_mock: {
      id:'guangdong_mock', title:'广东音乐统考综合模拟', minutes:75,
      sourceLabel:'原创模拟｜参照公开考试能力范围',
      sections:{ theory:14, single:6, interval:5, chord:5, rhythm:5, melody:5 }
    },
    xinghai_mock: {
      id:'xinghai_mock', title:'星海音乐学院校考机考模拟', minutes:50,
      sourceLabel:'原创校考模拟｜非官方真题',
      sections:{ single:10, interval:8, chord:8, rhythm:7, melody:7 }
    }
  };
  const expand = blueprint => Object.entries(blueprint.sections).flatMap(([type, count]) => Array(count).fill(type));
  const api = { blueprints, expand };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.HetianExamBlueprints = api;
})();
