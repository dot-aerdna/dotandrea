// Live VHS glitch for background videos. Add data-vhs to a <video>:
//   data-vhs-pos    0..1, where the 16:9 window sits on the cropped axis (0 top/left, 1 bottom/right). Default .5
//   data-vhs-start  first second of the loop. Default 0
//   data-vhs-end    last second of the loop. Default: end of the video
//   data-vhs-speed  playback speed. Default .6
//   data-vhs-bw     black and white
// The video is replaced by a 1280x720 canvas with the same classes, so CSS (object-fit, opacity) still applies.
// The source can change at any time (src swap): the canvas follows whatever the video is playing.
// While paused (pause button, reduced motion) the frame is drawn without glitches.
// Glitches: a tracking band across the loop point, a tear at 34.5% and a wobble with a scan line at 66.1% of the loop.
// Without WebGL (or on file://, where the video can't be read) the plain video stays visible.

const VHS_SHADER = `
precision highp float;
uniform sampler2D video;
uniform vec4 crop;      // x, y, width, height of the 16:9 window in texture space
uniform float T, D, N, bw;
varying vec2 p;

float hash(float v) { return fract(sin(v) * 43758.5453); }

void main() {
  float X = p.x * 1280., Y = p.y * 720.;
  float a = D * .345, b = D * .661;
  float band = max(0., 1. - min(T, D - T) / .2);
  float tear = step(a, T) * step(T, a + .06);
  float wobble = step(b, T) * step(T, b + .09);
  float bandY = 700. - (T < .2 ? T + .2 : T - D + .2) / .4 * 380.;
  float r = hash(Y * 12.9898 + N * 78.233);
  float dist = abs(Y - bandY);
  float shift = tear * step(300., Y) * step(Y, 360.) * 34.
    + wobble * step(150., Y) * step(Y, 560.) * 3. * sin(Y * .9 + N * 2.1)
    + band * step(dist, 140.) * (1. - dist / 140.) * (r - .5) * 24.;
  vec2 uv = crop.xy + vec2(clamp(X + shift, 0., 1279.) / 1280., p.y) * crop.zw;
  vec3 color = texture2D(video, uv).rgb;
  if (bw > .5) color = vec3(dot(color, vec3(.2126, .7152, .0722)));
  float k = band * step(dist, 11.) * (.7 + .3 * r) + wobble * step(418., Y) * step(Y, 420.) * .8;
  float noise = (150. + 105. * hash(X * 12.9898 + Y * 78.233 + N * 37.719)) / 255.;
  gl_FragColor = vec4(mix(color, vec3(noise), .85 * k), 1.);
}`;

function vhs(video) {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  canvas.className = video.className;
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl');
  if (!gl) return;

  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, 'attribute vec2 v; varying vec2 p; void main() { p = vec2(v.x, -v.y) * .5 + .5; gl_Position = vec4(v, 0, 1); }'],
    [gl.FRAGMENT_SHADER, VHS_SHADER],
  ]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const uniform = name => gl.getUniformLocation(program, name);

  const { vhsPos = .5, vhsStart = 0, vhsEnd, vhsSpeed = .6 } = video.dataset;
  const pos = Number(vhsPos), start = Number(vhsStart), speed = Number(vhsSpeed);
  gl.uniform1f(uniform('bw'), 'vhsBw' in video.dataset ? 1 : 0);
  video.playbackRate = video.defaultPlaybackRate = speed;
  let lastTime = -1, lastPaused, tainted = false;

  function frame() {
    if (tainted) return;
    requestAnimationFrame(frame);
    canvas.style.opacity = video.style.opacity; // inline opacity set by other scripts reaches the canvas
    if (video.readyState < 2 || (video.currentTime === lastTime && video.paused === lastPaused)) return;
    lastPaused = video.paused;
    const end = Math.min(Number(vhsEnd ?? Infinity), video.duration);
    // Restart just before the end so the loop never waits on the browser's own seek.
    if (video.currentTime < start || video.currentTime >= end - .05) video.currentTime = start;
    lastTime = video.currentTime;
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
    } catch {
      tainted = true;
      canvas.remove(); // tainted video (file://): show it without the effect
      video.style.display = '';
      return;
    }
    if (!canvas.isConnected) {
      video.after(canvas);
      video.style.display = 'none';
    }
    const aspect = video.videoWidth / video.videoHeight / (16 / 9);
    const w = Math.min(1, 1 / aspect), h = Math.min(1, aspect);
    gl.uniform4f(uniform('crop'), (1 - w) * pos, (1 - h) * pos, w, h);
    const D = (end - start) / speed;
    // A paused video shows a clean frame: mid-loop is far from every glitch.
    const T = video.paused ? D / 2 : (video.currentTime - start) / speed;
    gl.uniform1f(uniform('T'), T);
    gl.uniform1f(uniform('D'), D);
    gl.uniform1f(uniform('N'), Math.floor(T * 30));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  frame();
}

document.querySelectorAll('video[data-vhs]').forEach(vhs);
