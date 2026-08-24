(() => {
  'use strict';

  const hostname = location.hostname.toLowerCase();
  const hostProduct = hostname.startsWith('haitang-music.') || hostname === 'haitang-music.pages.dev'
    ? 'music'
    : hostname.startsWith('haitang-exam.') || hostname === 'haitang-exam.pages.dev'
      ? 'exam'
      : '';
  const requested = new URLSearchParams(location.search).get('product');
  const queryProduct = requested === 'music' || requested === 'exam' ? requested : '';
  const product = hostProduct || queryProduct;

  window.HaitangProduct = Object.freeze({ product, fixed: Boolean(hostProduct), hostname });
  window.HAITANG_PRODUCT = product;

  if (hostProduct && requested) {
    const url = new URL(location.href);
    url.searchParams.delete('product');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
})();
