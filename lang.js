(function () {
  window.LANG = localStorage.getItem('ai-sym-lang') || 'ru';
  document.documentElement.lang = window.LANG;

  window.T = function (ru, en) { return window.LANG === 'en' ? en : ru; };

  window.applyLang = function () {
    document.querySelectorAll('[data-en]').forEach(function (el) {
      if (!el.dataset.ru) el.dataset.ru = el.innerHTML;
      el.innerHTML = window.LANG === 'en' ? el.dataset.en : el.dataset.ru;
    });
    var btn = document.getElementById('langToggle');
    if (btn) {
      btn.innerHTML = window.LANG === 'en'
        ? '<span style="color:#e8eaf0">EN</span><span style="color:rgba(255,255,255,0.22)"> · </span><span style="color:#7a8099">RU</span>'
        : '<span style="color:#7a8099">EN</span><span style="color:rgba(255,255,255,0.22)"> · </span><span style="color:#e8eaf0">RU</span>';
    }
    document.documentElement.lang = window.LANG;
    // после подмены текста формулы снова сырые — перенабрать
    if (window.MathJax && window.MathJax.typesetPromise) window.MathJax.typesetPromise().catch(function () {});
  };

  window.toggleLang = function () {
    window.LANG = window.LANG === 'ru' ? 'en' : 'ru';
    localStorage.setItem('ai-sym-lang', window.LANG);
    window.applyLang();
    if (window.onLangChange) window.onLangChange();
  };

  function inject() {
    if (document.getElementById('langToggle')) { window.applyLang(); return; }
    var s = document.createElement('style');
    s.textContent =
      '#langToggle{position:fixed;top:14px;right:14px;z-index:9999;' +
      'font-family:"JetBrains Mono",monospace;font-size:11px;letter-spacing:.06em;' +
      'padding:5px 11px;border-radius:6px;border:0.5px solid rgba(255,255,255,0.14);' +
      'background:#151820;cursor:pointer;transition:border-color .2s;' +
      'display:inline-flex;align-items:center;gap:0;line-height:1}' +
      '#langToggle:hover{border-color:#3e8ef7}';
    document.head.appendChild(s);
    var btn = document.createElement('button');
    btn.id = 'langToggle';
    btn.onclick = window.toggleLang;
    btn.setAttribute('aria-label', 'Switch language');
    document.body.appendChild(btn);
    window.applyLang();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
