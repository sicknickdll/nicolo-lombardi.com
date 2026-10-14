// Makes the hero eye look at the cursor. The eye is a looping video, so instead of
// animating a drawing we redraw each video frame through a WebGL warp: pixels inside
// the eye opening are shifted towards the cursor (the iris moves rigidly, the white
// of the eye stretches around it) while the lids, lashes and hair stay still.
// Desktop only (needs a hovering pointer); skipped for reduced motion or without WebGL.

// Eye geometry in video pixels (the video is 1280×720): the eye opening as an
// ellipse, and the band (distance from the iris centre) where the white stretches.
const EYE = { x: 640, y: 385, rx: 245, ry: 130 };
const IRIS = { x: 632, inner: 140, outer: 235 };
// Furthest the iris travels, in video pixels.
const MAX = { x: 50, y: 10 };

const VERT = `attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}`;
const FRAG = `precision mediump float;
varying vec2 uv;
uniform sampler2D tex;
uniform vec2 size, center, radius, offset;
uniform vec3 iris;
void main(){
  vec2 px = vec2(uv.x, 1. - uv.y) * size;
  float lids = 1. - smoothstep(.8, 1., length((px - center) / radius));
  float w = lids * (1. - smoothstep(iris.y, iris.z, abs(px.x - iris.x)));
  gl_FragColor = texture2D(tex, (px - offset * w) / size);
}`;

export function eyeTracking(video) {
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return () => {};
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
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
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const u = (n) => gl.getUniformLocation(prog, n);
  const uSize = u("size"),
    uOffset = u("offset");
  gl.uniform2f(u("center"), EYE.x, EYE.y);
  gl.uniform2f(u("radius"), EYE.rx, EYE.ry);
  gl.uniform3f(u("iris"), IRIS.x, IRIS.inner, IRIS.outer);

  video.after(canvas);
  const target = { x: 0, y: 0 },
    look = { x: 0, y: 0 };
  let raf = 0,
    visible = true,
    ready = false;

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
  };

  const frame = () => {
    raf = 0;
    if (!visible) return;
    look.x += (target.x - look.x) * 0.12;
    look.y += (target.y - look.y) * 0.12;
    if (video.readyState >= 2) {
      const w = video.videoWidth,
        h = video.videoHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
        gl.uniform2f(uSize, w, h);
      }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
      gl.uniform2f(uOffset, look.x * MAX.x, look.y * MAX.y);
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
  document.documentElement.addEventListener("pointerleave", onLeave);
  start();

  return () => {
    cancelAnimationFrame(raf);
    io.disconnect();
    removeEventListener("pointermove", onMove);
    document.documentElement.removeEventListener("pointerleave", onLeave);
    canvas.remove();
  };
}
