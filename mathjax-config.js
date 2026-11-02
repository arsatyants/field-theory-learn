// Конфигурация MathJax 3: в нём нет \oiint / \oiiint (они появились только в esint),
// поэтому определяем свои: в выключных формулах — ∬ с кружком, в строчных — символ ∯.
window.MathJax = {
  tex: {
    macros: {
      oiint: '\\mathop{\\mathchoice{\\rlap{\\mkern10mu\\raise{0.1em}{\\bigcirc}}\\iint}{\\unicode{x222F}}{\\unicode{x222F}}{\\unicode{x222F}}}\\nolimits',
    },
  },
};
