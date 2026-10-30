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
const originalVideo = document.querySelector('.hero-original');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let effectsEnabled = true;
try {
  effectsEnabled = localStorage.getItem('effects') !== 'off';
} catch {}

function syncEffects() {
  effectsButton.setAttribute('aria-pressed', effectsEnabled);
  effectsButton.setAttribute('aria-label', `${effectsEnabled ? 'Disattiva' : 'Attiva'} animazione`);
  effectsButton.querySelector('img').src = `assets/icons/${effectsEnabled ? 'pause' : 'play'}.svg`;

  if (!effectsEnabled || reducedMotion.matches) {
    heroVideo.pause();
    originalVideo.pause();
  } else {
    originalVideo.play().catch(() => {});
    if (intensityControl.disabled) heroVideo.pause();
    else heroVideo.play().catch(() => {});
  }
}

effectsButton.addEventListener('click', () => {
  effectsEnabled = !effectsEnabled;
  try {
    localStorage.setItem('effects', effectsEnabled ? 'on' : 'off');
  } catch {}
  syncEffects();
});

reducedMotion.addEventListener('change', syncEffects);

const styleButton = document.querySelector('.style-toggle');
const intensityControl = document.querySelector('#effect-intensity');
const intensityValue = document.querySelector('#intensity-value');
const backgroundStyles = [
  { label: 'ASCII', file: 'waterfall-ascii', icon: 'text-aa', intensity: 50 },
  { label: 'Pixel', file: 'waterfall-pixel', icon: 'squares-four', intensity: 60 },
  { label: 'Retino', file: 'waterfall-halftone', icon: 'dots-nine', intensity: 25 },
  { label: 'Originale', file: 'waterfall', icon: 'image', intensity: 0 },
];
let styleIndex = 0;
let changingStyle = false;

function syncIntensity() {
  const style = backgroundStyles[styleIndex];
  intensityControl.disabled = style.file === 'waterfall';
  intensityControl.value = style.intensity;
  intensityControl.setAttribute('aria-valuetext', `${style.intensity}%`);
  intensityValue.value = `${style.intensity}%`;
  heroVideo.style.opacity = changingStyle ? 0 : style.intensity / 100;
}

intensityControl.addEventListener('input', () => {
  backgroundStyles[styleIndex].intensity = intensityControl.valueAsNumber;
  syncIntensity();
});

// Senza hover (telefono) lo slider si apre con una pressione lunga sull'icona; un tocco normale cambia stile.
const styleControl = document.querySelector('.style-control');
let longPressTimer;
let longPressed = false;

function closeIntensity() {
  styleControl.classList.toggle('is-open', false);
}

styleButton.addEventListener('pointerdown', event => {
  if (event.pointerType === 'mouse') return;
  longPressed = false;
  longPressTimer = setTimeout(() => {
    longPressed = true;
    styleControl.classList.toggle('is-open', true);
  }, 450);
});
for (const name of ['pointerup', 'pointercancel', 'pointerleave']) {
  styleButton.addEventListener(name, () => clearTimeout(longPressTimer));
}
// niente menu contestuale del browser durante la pressione lunga
styleButton.addEventListener('contextmenu', event => event.preventDefault());
document.addEventListener('pointerdown', event => {
  if (!styleControl.contains(event.target)) closeIntensity();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeIntensity();
});

styleButton.addEventListener('click', () => {
  if (longPressed) {
    longPressed = false;
    return;
  }
  styleIndex = (styleIndex + 1) % backgroundStyles.length;
  const style = backgroundStyles[styleIndex];
  const next = backgroundStyles[(styleIndex + 1) % backgroundStyles.length];
  styleButton.querySelector('img').src = `assets/icons/${style.icon}.svg`;
  const label = `Effetto: ${style.label}. Passa a ${next.label}`;
  styleButton.setAttribute('aria-label', label);
  styleButton.title = label;
  changingStyle = true;
  syncIntensity();
  if (style.file === 'waterfall') {
    changingStyle = false;
    syncEffects();
    return;
  }
  heroVideo.poster = `assets/${style.file}.webp`;
  heroVideo.src = `assets/${style.file}.mp4`;
  heroVideo.load();
});

heroVideo.addEventListener('loadedmetadata', () => {
  if (!changingStyle) return;
  heroVideo.currentTime = originalVideo.currentTime % heroVideo.duration;
});

heroVideo.addEventListener('loadeddata', () => {
  changingStyle = false;
  syncIntensity();
  syncEffects();
});

originalVideo.addEventListener('timeupdate', () => {
  if (!changingStyle && !intensityControl.disabled && !heroVideo.seeking && heroVideo.readyState >= 2 &&
      Math.abs(heroVideo.currentTime - originalVideo.currentTime) > .1) {
    heroVideo.currentTime = originalVideo.currentTime % heroVideo.duration;
  }
});

syncIntensity();
syncEffects();

const bwButton = document.querySelector('.bw-toggle');
const heroBackground = document.querySelector('.hero-background');
let blackAndWhite = false;
try {
  blackAndWhite = localStorage.getItem('bw') === 'on';
} catch {}

function syncBlackAndWhite() {
  bwButton.setAttribute('aria-pressed', blackAndWhite);
  heroBackground.classList.toggle('is-bw', blackAndWhite);
}

bwButton.addEventListener('click', () => {
  blackAndWhite = !blackAndWhite;
  try {
    localStorage.setItem('bw', blackAndWhite ? 'on' : 'off');
  } catch {}
  syncBlackAndWhite();
});

syncBlackAndWhite();
