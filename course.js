(function(){
  const btns = document.querySelectorAll('#stepNav .step-btn');
  const sections = document.querySelectorAll('.step-section');
  if (!btns.length || !sections.length) return;

  function showStep(n){
    const step = parseInt(n, 10);
    sections.forEach(s => {
      if (parseInt(s.dataset.step, 10) === step) {
        s.classList.add('active');
      } else {
        s.classList.remove('active');
      }
    });
    btns.forEach(b => {
      if (parseInt(b.dataset.step, 10) === step) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
    window.scrollTo({top:0, behavior:'smooth'});
  }

  btns.forEach(btn => {
    btn.addEventListener('click', () => showStep(btn.dataset.step));
  });

  // keyboard nav left/right arrow
  document.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const active = document.querySelector('#stepNav .step-btn.active');
    if (!active) return;
    const total = btns.length;
    let step = parseInt(active.dataset.step, 10);
    if (e.key === 'ArrowRight') step = Math.min(total - 1, step + 1);
    else step = Math.max(0, step - 1);
    showStep(step);
  });
})();
