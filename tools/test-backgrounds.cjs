const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function element() {
  return {
    events: {}, attributes: {}, textContent: '',
    addEventListener(name, handler) { this.events[name] = handler; },
    setAttribute(name, value) { this.attributes[name] = value; },
    querySelector() { return {}; },
  };
}

const styleIcon = {};
const style = Object.assign(element(), { querySelector() { return styleIcon; } });
const intensity = Object.assign(element(), {
  value: '50', disabled: false,
});
Object.defineProperty(intensity, 'valueAsNumber', { get() { return Number(this.value); } });
const intensityValue = element();
const effects = element();
const bw = element();
const classes = new Set();
const background = Object.assign(element(), { classList: { toggle(name, on) { if (on) classes.add(name); else classes.delete(name); } } });
const reduced = Object.assign(element(), { matches: false });
const video = Object.assign(element(), {
  currentTime: 4.2, duration: 8.4, paused: false, style: {}, readyState: 2, seeking: false,
  play() { this.paused = false; return Promise.resolve(); },
  pause() { this.paused = true; },
  load() { this.currentTime = 0; this.duration = NaN; this.paused = true; },
});
const original = Object.assign(element(), {
  currentTime: 4.2, duration: 8.4, paused: false,
  play() { this.paused = false; return Promise.resolve(); },
  pause() { this.paused = true; },
});
const openClasses = new Set();
const styleControl = Object.assign(element(), {
  classList: { toggle(name, on) { if (on) openClasses.add(name); else openClasses.delete(name); } },
  contains(target) { return target === style || target === intensity; },
});
const documentEvents = {};
let pendingTimer = null;
const root = path.resolve(__dirname, '..');
vm.runInNewContext(fs.readFileSync(path.join(root, 'script.js'), 'utf8'), {
  document: {
    documentElement: { dataset: {} }, body: {},
    addEventListener(name, handler) { documentEvents[name] = handler; },
    querySelector(selector) {
      return ({ '.hero-photo': video, '.hero-original': original, '.effects-toggle': effects,
        '.style-toggle': style, '#effect-intensity': intensity, '#intensity-value': intensityValue,
        '.bw-toggle': bw, '.hero-background': background, '.style-control': styleControl })[selector] ?? element();
    },
  },
  window: { matchMedia(query) { return query.includes('reduced-motion') ? reduced : element(); } },
  localStorage: { getItem() { return null; }, setItem() {} },
  getComputedStyle() { return { backgroundColor: '#0b1723' }; },
  setTimeout(callback) { pendingTimer = callback; return 1; },
  clearTimeout() { pendingTimer = null; },
});

function loaded() {
  if (intensity.disabled) return;
  video.duration = 8.4;
  video.events.loadedmetadata();
  video.events.loadeddata();
  assert.equal(video.currentTime, original.currentTime, 'Keep playback position');
  assert(fs.existsSync(path.join(root, video.src)), 'Selected video exists');
  assert(fs.existsSync(path.join(root, video.poster)), 'Selected poster exists');
}

for (const [label, file, next, icon] of [
  ['Pixel', 'waterfall-pixel', 'Retino', 'squares-four'],
  ['Retino', 'waterfall-halftone', 'Originale', 'dots-nine'],
  ['Originale', 'waterfall', 'ASCII', 'image'],
  ['ASCII', 'waterfall-ascii', 'Pixel', 'text-aa'],
]) {
  style.events.click();
  assert.equal(styleIcon.src, `assets/icons/${icon}.svg`);
  assert(fs.existsSync(path.join(root, styleIcon.src)), 'Style icon exists');
  if (label !== 'Originale') assert.equal(video.src, `assets/${file}.mp4`);
  assert.equal(style.attributes['aria-label'], `Effetto: ${label}. Passa a ${next}`);
  if (label !== 'Originale') loaded();
  assert(!original.paused, 'Continue original playback after changing style');
  assert.equal(intensity.disabled, label === 'Originale');
  assert.equal(video.paused, label === 'Originale');
}

assert.equal(video.style.opacity, .5, 'ASCII starts at 50%');
style.events.click();
loaded();
assert.equal(video.style.opacity, .6, 'Pixel starts at 60%');
for (const value of [0, 65, 100]) {
  intensity.value = String(value);
  intensity.events.input();
  assert.equal(video.style.opacity, value / 100);
  assert.equal(intensityValue.value, `${value}%`);
}
style.events.click();
loaded();
assert.equal(video.style.opacity, .25, 'Halftone starts at 25%');
for (let i = 0; i < 3; i++) style.events.click();
loaded();
assert.equal(video.style.opacity, 1, 'Per-style intensity survives cycling');

style.events.click();
style.events.click();
loaded();
assert.equal(styleIcon.src, 'assets/icons/image.svg', 'Rapid clicks select the latest style');

effects.events.click();
assert(video.paused);
assert(original.paused);
style.events.click();
loaded();
assert(video.paused, 'Changing style preserves pause');
assert(original.paused, 'Original remains paused too');

effects.events.click();
reduced.matches = true;
reduced.events.change();
style.events.click();
loaded();
assert(video.paused, 'Changing style respects reduced motion');
assert(original.paused, 'Reduced motion pauses both layers');
assert.equal(styleIcon.src, 'assets/icons/squares-four.svg');

original.currentTime = 6;
original.events.timeupdate();
assert.equal(video.currentTime, 6, 'Correct drift between background layers');
const iconBeforePress = styleIcon.src;
style.events.pointerdown({ pointerType: 'touch' });
pendingTimer();
assert(openClasses.has('is-open'), 'Long press opens the intensity slider');
style.events.pointerup();
style.events.click();
assert.equal(styleIcon.src, iconBeforePress, 'Long press does not change style');
documentEvents.pointerdown({ target: intensity });
assert(openClasses.has('is-open'), 'Touching the slider keeps it open');
documentEvents.pointerdown({ target: {} });
assert(!openClasses.has('is-open'), 'Touching elsewhere closes it');
style.events.pointerdown({ pointerType: 'touch' });
style.events.pointerup();
assert.equal(pendingTimer, null, 'Short tap cancels the long press');
style.events.click();
assert.notEqual(styleIcon.src, iconBeforePress, 'Short tap still changes style');
style.events.pointerdown({ pointerType: 'mouse' });
assert.equal(pendingTimer, null, 'Mouse uses hover, not long press');
documentEvents.keydown({ key: 'Escape' });

assert(!classes.has('is-bw'), 'Colour by default');
bw.events.click();
assert(classes.has('is-bw') && bw.attributes['aria-pressed'] === true, 'Black and white on');
bw.events.click();
assert(!classes.has('is-bw') && bw.attributes['aria-pressed'] === false, 'Black and white off');
console.log('OK: long press, black and white, styles, intensity endpoints, per-style values, synchronization, rapid clicks, pause and reduced motion');
