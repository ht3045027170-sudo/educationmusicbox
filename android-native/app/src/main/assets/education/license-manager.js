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

  const freeLicense = () => ({ type:'free', status:'active', expireDate:'', features:[...LICENSES.free.features] });
  let verifiedLicense = freeLicense(), generation = 0;
  function getLicense() { return { ...verifiedLicense, features:[...verifiedLicense.features] }; }
  async function requestLicense(code) {
    const token = ++generation, userId = window.HetianAuth?.getUser?.()?.id || null;
    const headers = { 'content-type':'application/json' };
    if (code !== undefined) {
      const csrfResponse = await fetch('/api/csrf', { credentials:'same-origin', cache:'no-store' });
      headers['x-csrf-token'] = (await csrfResponse.json()).csrfToken || '';
    }
    const response = await fetch('/api/auth/entitlements', { method:code === undefined ? 'GET' : 'POST', credentials:'same-origin', cache:'no-store', headers, ...(code === undefined ? {} : { body:JSON.stringify({ code }) }) });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || '暂时无法确认会员权限。');
    if (token !== generation || String(window.HetianAuth?.getUser?.()?.id || '') !== String(userId || '') || String(data.license.userId || '') !== String(userId || '')) return {ok:false,error:'登录账号已改变，请重新确认权限。'};
    verifiedLicense = { ...data.license, features:Array.isArray(data.license.features) ? data.license.features : [] };
    window.dispatchEvent(new CustomEvent('hetian:license-changed'));
    return {ok:true,license:getLicense()};
  }
  async function refresh() { verifiedLicense = freeLicense(); try { return await requestLicense(); } catch (error) { return {ok:false,error:error.message}; } }

  function isActive(license = getLicense()) {
    if (license.status !== 'active') return false;
    return !license.expireDate || new Date(license.expireDate).getTime() >= Date.now();
  }

  function featuresFor(license = getLicense()) {
    if (!isActive(license)) return LICENSES.free.features;
    const base = LICENSES[license.type]?.features || LICENSES.free.features;
    return [...new Set([...(base || []), ...(license.features || [])])];
  }

  function hasAdminUnlock() { return isActive() && verifiedLicense.type === 'developer' && verifiedLicense.verified === true; }

  function canAccess(feature) {
    if (!feature) return true;
    if (hasAdminUnlock()) return true;
    const features = featuresFor();
    return features.includes('*') || features.includes(feature);
  }

  const canUse = canAccess;

  async function activateCode(code) {
    try { return await requestLicense(String(code || '').trim()); }
    catch (error) { return {ok:false,error:error.message}; }
  }
  function deactivate() { generation++; verifiedLicense = freeLicense(); return getLicense(); }

  function label() {
    if (hasAdminUnlock()) return '管理员权限（全部解锁）';
    const type = getLicense().type;
    return ({ free:'免费版', student_pro:'学生专业版', ai_teacher:'AI 教师版', teacher:'教师版', developer:'管理员权限' })[type] || '免费版';
  }

  window.LicenseManager = { LICENSES, getLicense, isActive, featuresFor, canAccess, canUse, activateCode, deactivate, refresh, label, hasAdminUnlock };
  window.addEventListener('hetian:auth-changed', () => { deactivate(); refresh(); });
  window.addEventListener('online', refresh);
})();
