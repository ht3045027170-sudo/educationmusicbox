(() => {
  'use strict';
  const metadata = window.HETIAN_QUESTION_QUALITY?.questions || {};
  const apply = question => Object.assign(question, metadata[question.id] || {
    reviewStatus:'needs_review', reviewedBy:'', reviewedAt:'', version:1,
    difficultyEvidence:'unverified', deprecatedReason:''
  });
  [
    window.GAOKAO_THEORY_BANK?.questions,
    window.GAOKAO_QUESTION_BANK?.questions,
    window.GAOKAO_EXTRA_THEORY_BANK?.questions
  ].filter(Array.isArray).forEach(bank => bank.forEach(apply));
  window.HetianQuestionQuality = { apply, isApproved:question => apply(question).reviewStatus === 'approved' };
})();
