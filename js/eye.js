// Draws the hero eye as ASCII art that ripples around the cursor, and makes the eye
// look at the cursor. The eye is a looping video, so each frame goes through one WebGL
// pass: the screen is cut into character cells, each cell samples the video (warped so
// the iris follows the cursor while lids, lashes and hair stay still) and picks a glyph
// by brightness. Moving or tapping sends out rings that brighten and thicken the glyphs.
// Eye tracking needs a hovering pointer; touch screens get the ASCII and tap ripples.
// Skipped for reduced motion or without WebGL (the plain video stays).

// Eye geometry in video pixels (the video is 1280×720): the eye opening as an
// ellipse, and the band (distance from the iris centre) where the white stretches.
const EYE = { x: 640, y: 385, rx: 245, ry: 130 };
const IRIS = { x: 632, inner: 140, outer: 235 };
// Furthest the iris travels, in video pixels.
const MAX = { x: 50, y: 10 };
// Glyphs from dark to bright, character cell size in CSS pixels.
const CHARS = " .:-=+*#%@";
const CELL = 9;
// Ripples: how many live at once, how long each lasts (s), how fast it spreads (CSS px/s),
// and how far the pointer must travel before it drops a new one (CSS px).
const RIPPLES = 10;
const LIFE = 1.8;
const SPEED = 520;
const STEP = 70;

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
const FRAG = `precision mediump float;
uniform sampler2D tex, glyphs;
uniform vec2 res, size, center, radius, offset;
uniform vec3 iris;
uniform float cell, time, speed;
uniform vec3 ripples[${RIPPLES}];
const float N = ${CHARS.length}.;
void main(){
  vec2 fc = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y);
  vec2 c = (floor(fc / cell) + .5) * cell;
  vec2 local = fract(fc / cell);
  float wave = 0.;
  for (int i = 0; i < ${RIPPLES}; i++) {
    vec3 r = ripples[i];
    float age = time - r.z;
    if (age < 0. || age > ${LIFE.toFixed(2)}) continue;
    float d = (distance(c, r.xy) - age * speed) / (cell * 2.5);
    wave += exp(-d * d) * (1. - age / ${LIFE.toFixed(2)});
  }
  wave = min(wave, 1.);
  // Cell centre in video pixels, matching object-fit: cover.
  float s = max(res.x / size.x, res.y / size.y);
  vec2 px = (c - res * .5) / s + size * .5;
  float lids = 1. - smoothstep(.8, 1., length((px - center) / radius));
  float w = lids * (1. - smoothstep(iris.y, iris.z, abs(px.x - iris.x)));
  vec3 col = texture2D(tex, (px - offset * w) / size).rgb;
  float l = clamp(pow(dot(col, vec3(.299, .587, .114)), .7) + wave * .55, 0., 1.);
  float g = min(floor(l * N), N - 1.);
  float mask = texture2D(glyphs, vec2((g + local.x) / N, local.y)).r;
  vec3 tint = mix(col * 1.25, vec3(1.), wave * .7);
  gl_FragColor = vec4(tint * mask, 1.);
}`;

// One row of glyphs, white on black, each in a square tile.
function glyphAtlas(tile) {
  const c = document.createElement("canvas");
  c.width = tile * CHARS.length;
  c.height = tile;
  const g = c.getContext("2d");
  g.fillStyle = "#000";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#fff";
  g.font = `700 ${Math.round(tile * 0.95)}px ui-monospace, Menlo, Consolas, monospace`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  [...CHARS].forEach((ch, i) => g.fillText(ch, i * tile + tile / 2, tile / 2 + tile * 0.05));
  return c;
}

export function eyeTracking(video) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  const tracks = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const canvas = document.createElement("canvas");
  canvas.className = "eye-canvas";
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false });
  if (!gl) return () => {};

  const shader = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return () => {};
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const texture = (unit) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  const u = (n) => gl.getUniformLocation(prog, n);
  const dpr = Math.min(devicePixelRatio || 1, 2);
  texture(1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, glyphAtlas(Math.round(CELL * dpr)));
  texture(0);
  gl.uniform1i(u("tex"), 0);
  gl.uniform1i(u("glyphs"), 1);
  const uRes = u("res"),
    uSize = u("size"),
    uOffset = u("offset"),
    uTime = u("time"),
    uRipples = u("ripples");
  gl.uniform2f(u("center"), EYE.x, EYE.y);
  gl.uniform2f(u("radius"), EYE.rx, EYE.ry);
  gl.uniform3f(u("iris"), IRIS.x, IRIS.inner, IRIS.outer);
  gl.uniform1f(u("cell"), CELL * dpr);
  gl.uniform1f(u("speed"), SPEED * dpr);

  video.after(canvas);
  const target = { x: 0, y: 0 },
    look = { x: 0, y: 0 };
  // Ripples as x, y (canvas pixels), start time; -99 marks a free slot.
  const ripples = new Float32Array(RIPPLES * 3).fill(-99);
  const t0 = performance.now();
  const now = () => (performance.now() - t0) / 1000;
  let raf = 0,
    visible = true,
    ready = false,
    next = 0,
    last = null;

  const addRipple = (e) => {
    const r = canvas.getBoundingClientRect();
    if (e.clientY < r.top || e.clientY > r.bottom) return;
    ripples.set([(e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr, now()], next * 3);
    next = (next + 1) % RIPPLES;
    last = { x: e.clientX, y: e.clientY };
  };

  // Where the eye centre sits on screen, given the video is drawn with object-fit: cover.
  const eyeOnScreen = () => {
    const r = canvas.getBoundingClientRect(),
      vw = video.videoWidth || 1280,
      vh = video.videoHeight || 720,
      s = Math.max(r.width / vw, r.height / vh);
    return {
      x: r.left + r.width / 2 + (EYE.x - vw / 2) * s,
      y: r.top + r.height / 2 + (EYE.y - vh / 2) * s,
    };
  };
  const onMove = (e) => {
    if (!last || Math.hypot(e.clientX - last.x, e.clientY - last.y) > STEP) addRipple(e);
    if (!tracks) return;
    const eye = eyeOnScreen(),
      dx = e.clientX - eye.x,
      dy = e.clientY - eye.y,
      reach = Math.min(innerWidth, innerHeight) * 0.45,
      dist = Math.hypot(dx, dy) || 1,
      k = Math.min(1, dist / reach) / dist;
    target.x = dx * k;
    target.y = dy * k;
  };
  const onLeave = () => {
    target.x = target.y = 0;
    last = null;
  };

  const frame = () => {
    raf = 0;
    if (!visible) return;
    // Hidden under the landing intro: skip the per-frame video upload.
    if (document.documentElement.classList.contains("intro")) {
      raf = requestAnimationFrame(frame);
      return;
    }
    look.x += (target.x - look.x) * 0.12;
    look.y += (target.y - look.y) * 0.12;
    if (video.readyState >= 2) {
      const w = Math.round(canvas.clientWidth * dpr),
        h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
        gl.uniform2f(uRes, w, h);
      }
      gl.uniform2f(uSize, video.videoWidth, video.videoHeight);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
      gl.uniform2f(uOffset, look.x * MAX.x, look.y * MAX.y);
      gl.uniform1f(uTime, now());
      gl.uniform3fv(uRipples, ripples);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!ready) canvas.classList.add("ready"), (ready = true);
    }
    raf = requestAnimationFrame(frame);
  };
  const start = () => raf || (raf = requestAnimationFrame(frame));

  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start();
  });
  io.observe(canvas);
  addEventListener("pointermove", onMove, { passive: true });
  addEventListener("pointerdown", addRipple, { passive: true });
  document.documentElement.addEventListener("pointerleave", onLeave);
  start();

  return () => {
    cancelAnimationFrame(raf);
    io.disconnect();
    removeEventListener("pointermove", onMove);
    removeEventListener("pointerdown", addRipple);
    document.documentElement.removeEventListener("pointerleave", onLeave);
    canvas.remove();
  };
}
