const themeButton = document.querySelector('.theme-toggle');
const themeColor = document.querySelector('meta[name="theme-color"]');
const darkScheme = window.matchMedia('(prefers-color-scheme: dark)');
const themes = {
  auto: { label: 'automatico', icon: 'circle-half' },
  light: { label: 'chiaro', icon: 'sun' },
  dark: { label: 'scuro', icon: 'moon' },
};

let theme = 'auto';
try {
  theme = localStorage.getItem('theme') ?? 'auto';
} catch {}
if (!(theme in themes)) theme = 'auto';

function syncTheme() {
  if (theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  themeButton.setAttribute('aria-label', `Tema: ${themes[theme].label}`);
  themeButton.querySelector('img').src = `assets/icons/${themes[theme].icon}.svg`;
  themeColor.content = getComputedStyle(document.body).backgroundColor;
}

themeButton.addEventListener('click', () => {
  const keys = Object.keys(themes);
  theme = keys[(keys.indexOf(theme) + 1) % keys.length];
  try {
    if (theme === 'auto') localStorage.removeItem('theme');
    else localStorage.setItem('theme', theme);
  } catch {}
  syncTheme();
});

darkScheme.addEventListener('change', syncTheme);
syncTheme();

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
  effectsButton.querySelector('img').src = `assets/icons/${effectsEnabled ? 'pause' : 'play'}.svg`;

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
