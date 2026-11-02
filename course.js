// course.js — переключение шагов модуля, кнопки «назад / далее», якорь #step-N в адресе.
(function () {
  const btns = [...document.querySelectorAll('.step-btn')];
  const secs = [...document.querySelectorAll('.step-section')];
  if (!btns.length) return;
  const T = (ru, en) => (window.LANG === 'en' ? en : ru);

  function show(n, scroll) {
    n = Math.max(0, Math.min(secs.length - 1, n));
    btns.forEach(b => b.classList.toggle('active', +b.dataset.step === n));
    secs.forEach(s => s.classList.toggle('active', +s.dataset.step === n));
    if (location.hash !== '#step-' + n) history.replaceState(null, '', '#step-' + n);
    if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  btns.forEach(b => b.addEventListener('click', () => show(+b.dataset.step, false)));

  // пейджер внизу каждого шага
  const pagers = [];
  secs.forEach(s => {
    const n = +s.dataset.step, p = document.createElement('div');
    p.className = 'step-pager';
    const prev = document.createElement('button'), next = document.createElement('button');
    prev.disabled = n === 0; next.disabled = n === secs.length - 1;
    prev.onclick = () => show(n - 1, true); next.onclick = () => show(n + 1, true);
    p.append(prev, next); s.appendChild(p);
    pagers.push(() => {
      const pb = btns[n - 1], nb = btns[n + 1];
      prev.textContent = '← ' + (pb ? pb.textContent : T('назад', 'back'));
      next.textContent = (nb ? nb.textContent : T('далее', 'next')) + ' →';
    });
  });
  const relabel = () => pagers.forEach(f => f());
  const prevHook = window.onLangChange;
  window.onLangChange = function () { if (prevHook) prevHook(); relabel(); };

  function init() {
    relabel();
    const m = /^#step-(\d+)$/.exec(location.hash);
    if (m) show(+m[1], false);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
