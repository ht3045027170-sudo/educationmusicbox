(() => {
  'use strict';

  const Education = window.HetianEducation;
  if (!Education) return;

  const LICENSES = {
    free: { features:['basic_tools', 'guest_mode', 'ear_basic', 'theory_chapter_1', 'theory_chapter_2'] },
    student_pro: { features:['basic_tools', 'guest_mode', 'ear_basic', 'advanced_level', 'theory_full', 'reports', 'voice_training', 'sight_singing'] },
    ai_teacher: { features:['basic_tools', 'advanced_level', 'theory_full', 'reports', 'voice_training', 'sight_singing', 'ai_analysis'] },
    teacher: { features:['basic_tools', 'advanced_level', 'theory_full', 'reports', 'voice_training', 'sight_singing', 'teacher_question_bank', 'classroom_management'] },
    developer: { features:['*'] }
  };

  // 兑换策略集中在此处；UI 与关卡不得直接写入“全部解锁”。
  const TEST_CODES = {
    '200791': { type:'developer', status:'active', expireDate:'', features:['*'] }
  };

  function getLicense() {
    const license = Education.getState().license || {};
    return { type:'free', status:'active', expireDate:'', features:[], ...license };
  }

  function isActive(license = getLicense()) {
    if (license.status !== 'active') return false;
    return !license.expireDate || new Date(`${license.expireDate}T23:59:59`).getTime() >= Date.now();
  }

  function featuresFor(license = getLicense()) {
    if (!isActive(license)) return LICENSES.free.features;
    const base = LICENSES[license.type]?.features || LICENSES.free.features;
    return [...new Set([...(base || []), ...(license.features || [])])];
  }

  function hasAdminUnlock() {
    return window.HetianAuth?.getUser?.()?.role === 'admin';
  }

  function canAccess(feature) {
    if (!feature) return true;
    if (hasAdminUnlock()) return true;
    const features = featuresFor();
    return features.includes('*') || features.includes(feature);
  }

  const canUse = canAccess;

  function activateCode(code) {
    const config = TEST_CODES[String(code || '').trim()];
    if (!config) return { ok:false, reason:'invalid' };
    Education.updateState(state => {
      state.license = { ...config, activatedCode:String(code).trim(), activatedAt:Date.now() };
      return state;
    });
    return { ok:true, license:getLicense() };
  }

  function deactivate() {
    Education.updateState(state => {
      state.license = { type:'free', status:'active', expireDate:'', features:[...LICENSES.free.features], activatedCode:'', activatedAt:0 };
      return state;
    });
    return getLicense();
  }

  function toggleTestCode(code) {
    const current = getLicense();
    if (current.type === 'developer' && current.status === 'active' && current.activatedCode === String(code).trim()) {
      deactivate();
      return { ok:true, active:false, license:getLicense() };
    }
    const result = activateCode(code);
    return { ...result, active:result.ok };
  }

  function label() {
    if (hasAdminUnlock()) return '管理员权限（全部解锁）';
    const type = getLicense().type;
    return ({ free:'免费版', student_pro:'学生专业版', ai_teacher:'AI 教师版', teacher:'教师版', developer:'开发者测试权限' })[type] || '免费版';
  }

  window.LicenseManager = { LICENSES, getLicense, isActive, featuresFor, canAccess, canUse, activateCode, deactivate, toggleTestCode, label, hasAdminUnlock };
})();
