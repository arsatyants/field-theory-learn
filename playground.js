// Rust Playground API runner
// POST https://play.rust-lang.org/execute
async function runRust(code, outputEl, btnEl) {
  if (btnEl) { btnEl.disabled = true; btnEl.textContent = '⏳ Running…'; }
  outputEl.className = 'output-box loading';
  outputEl.textContent = 'Running on play.rust-lang.org…';
  try {
    const res = await fetch('https://play.rust-lang.org/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'stable',
        mode: 'debug',
        edition: '2021',
        crateType: 'bin',
        tests: false,
        backtrace: false,
        code,
      }),
    });
    const data = await res.json();
    if (data.success) {
      outputEl.className = 'output-box ok';
      outputEl.textContent = data.stdout || '(no output)';
    } else {
      outputEl.className = 'output-box err';
      outputEl.textContent = (data.stderr || data.stdout || 'Unknown error').trim();
    }
  } catch (e) {
    outputEl.className = 'output-box err';
    outputEl.textContent = 'Network error: ' + e.message;
  } finally {
    if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = '▶ Run'; }
  }
}

function initEditors() {
  document.querySelectorAll('.editor-wrap').forEach(wrap => {
    const btn = wrap.querySelector('.run-btn');
    const ta  = wrap.querySelector('.code-area');
    const out = wrap.querySelector('.output-box');
    if (btn && ta && out) {
      btn.addEventListener('click', () => runRust(ta.value, out, btn));
    }
  });
}
document.addEventListener('DOMContentLoaded', initEditors);
