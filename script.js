const effectsButton = document.querySelector('.effects-toggle');
const heroVideo = document.querySelector('.hero-photo');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let effectsEnabled = true;
try {
  effectsEnabled = localStorage.getItem('effects') !== 'off';
} catch {}

function syncEffects() {
  effectsButton.setAttribute('aria-pressed', effectsEnabled);
  effectsButton.setAttribute('aria-label', `${effectsEnabled ? 'Disattiva' : 'Attiva'} animazione`);

  if (!effectsEnabled || reducedMotion.matches) heroVideo.pause();
  else heroVideo.play().catch(() => {});
}

effectsButton.addEventListener('click', () => {
  effectsEnabled = !effectsEnabled;
  try {
    localStorage.setItem('effects', effectsEnabled ? 'on' : 'off');
  } catch {}
  syncEffects();
});

reducedMotion.addEventListener('change', syncEffects);
syncEffects();
