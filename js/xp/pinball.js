// "Nicoló Pinball" — an original neon pinball table.
// Keys: Z / ← left flipper, / or → right flipper, hold Space or ↓ to launch.
// Touch: left / right half of the table = flippers, bottom-right corner = launch.
const W = 360,
  H = 600,
  R = 8; // ball radius
const GRAVITY = 0.16,
  SUB = 4; // physics sub-steps per frame

// Static walls as line segments [x1, y1, x2, y2, bounciness, oneSided].
// One-sided walls are the table edge: the playfield is on the right-hand side of
// the direction they're drawn in, and a ball that got past them is pushed back in.
const WALLS = [
  // outer outline
  [12, 470, 12, 90, 0.5, true],
  [12, 90, 40, 38, 0.5, true],
  [40, 38, 100, 14, 0.5, true],
  [100, 14, 260, 14, 0.5, true],
  [260, 14, 318, 34, 0.5, true],
  [318, 34, 348, 76, 0.5, true],
  [348, 76, 348, 600, 0.3, true],
  // plunger lane inner wall
  [318, 150, 318, 600, 0.3],
  // funnels down to the flippers
  [98, 532, 12, 470, 0.4, true],
  [318, 470, 232, 532, 0.4, true],
  // slingshots (bouncy)
  [52, 400, 52, 448, 0.4],
  [52, 448, 92, 472, 0.4],
  [92, 472, 52, 400, 1.35],
  [278, 400, 278, 448, 0.4],
  [278, 448, 238, 472, 0.4],
  [238, 472, 278, 400, 1.35],
  // little top lanes
  [130, 40, 130, 70, 0.5],
  [170, 40, 170, 70, 0.5],
  [210, 40, 210, 70, 0.5],
];
const BUMPERS = [
  { x: 110, y: 150, r: 20, color: "#ff3ea5" },
  { x: 210, y: 140, r: 20, color: "#33d6ff" },
  { x: 160, y: 215, r: 22, color: "#ffd23e" },
  { x: 240, y: 260, r: 14, color: "#7b5cff" },
];
const TARGETS = [
  { x: 40, y: 230, w: 8, h: 34 },
  { x: 40, y: 290, w: 8, h: 34 },
];
const LANES = [110, 150, 190]; // centers of top rollover lanes (y≈55)

export function mount(el, api, windowEl) {
  el.innerHTML = `<div class="pb-wrap"><canvas width="${W}" height="${H}" aria-label="Pinball table"></canvas></div><footer class="xp-status pb-help">Z / ← · / / → flippers · hold Space to launch · touch: tap sides, bottom-right to launch</footer>`;
  const canvas = el.querySelector("canvas"),
    ctx = canvas.getContext("2d");
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const flippers = [
    { x: 98, y: 532, len: 58, dir: 1, rest: 0.52, up: -0.5, a: 0.52, w: 0, pressed: false },
    { x: 232, y: 532, len: 58, dir: -1, rest: 0.52, up: -0.5, a: 0.52, w: 0, pressed: false },
  ];
  let ball,
    score,
    balls,
    plunger,
    charging,
    lanesLit,
    flash,
    message,
    gameOver,
    best = (() => {
      try {
        return +localStorage.getItem("nicolo-pinball-best") || 0;
      } catch {
        return 0;
      }
    })();

  function newGame() {
    score = 0;
    balls = 3;
    gameOver = false;
    lanesLit = [false, false, false];
    resetBall();
    message = "Hold SPACE (or tap bottom-right) to launch";
  }
  function resetBall() {
    ball = { x: 333, y: 560, vx: 0, vy: 0, inLane: true };
    plunger = 0;
    charging = false;
  }
  newGame();

  // Flipper tip position for its current angle.
  const tip = (f) => ({ x: f.x + Math.cos(f.a) * f.len * f.dir, y: f.y + Math.sin(f.a) * f.len });

  function collideSegment(x1, y1, x2, y2, bounce, oneSided, surface) {
    const dx = x2 - x1,
      dy = y2 - y1;
    const t = Math.max(
      0,
      Math.min(1, ((ball.x - x1) * dx + (ball.y - y1) * dy) / (dx * dx + dy * dy)),
    );
    const cx = x1 + t * dx,
      cy = y1 + t * dy;
    let nx = ball.x - cx,
      ny = ball.y - cy;
    let d = Math.hypot(nx, ny);
    if (oneSided && t > 0 && t < 1) {
      // Signed distance from the inside face: negative means the ball got through.
      const len = Math.hypot(dx, dy);
      const inX = -dy / len,
        inY = dx / len;
      const sd = nx * inX + ny * inY;
      if (sd >= R || sd < -40) return false;
      nx = inX;
      ny = inY;
      d = 1;
    } else {
      if (d >= R || d === 0) return false;
      nx /= d;
      ny /= d;
    }
    ball.x = cx + nx * R;
    ball.y = cy + ny * R;
    const sv = surface ? surface(cx, cy) : { x: 0, y: 0 };
    const rvx = ball.vx - sv.x,
      rvy = ball.vy - sv.y;
    const vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      ball.vx -= (1 + bounce) * vn * nx;
      ball.vy -= (1 + bounce) * vn * ny;
      if (bounce > 1) score += 10;
    }
    return true;
  }

  function step() {
    // flippers
    for (const f of flippers) {
      const target = f.pressed ? f.up : f.rest;
      const prev = f.a;
      const speed = 0.11;
      f.a += Math.max(-speed, Math.min(speed, target - f.a));
      f.w = (f.a - prev) * f.dir; // angular velocity (screen space, per sub-step)
    }
    if (ball.inLane && !charging && ball.y >= 560 && ball.vy === 0) return;
    ball.vy += (GRAVITY / SUB) * 1;
    ball.x += ball.vx / SUB;
    ball.y += ball.vy / SUB;
    ball.vx *= 0.9995;
    ball.vy *= 0.9995;
    if (ball.y < 150 && ball.x < 318) ball.inLane = false;
    if (ball.x > 320 && ball.y > 150) ball.inLane = true; // fell back into the launch lane
    for (const w of WALLS) collideSegment(...w);
    // lane plunger floor
    if (ball.inLane && ball.y > 560) {
      ball.y = 560;
      ball.vy = 0;
      ball.vx = 0;
    }
    for (const f of flippers) {
      const t = tip(f);
      collideSegment(f.x, f.y, t.x, t.y, 0.25, false, (px, py) => {
        const w = f.w * SUB; // f.w already includes the flipper's direction
        return { x: -w * (py - f.y), y: w * (px - f.x) };
      });
    }
    for (const b of BUMPERS) {
      const dx = ball.x - b.x,
        dy = ball.y - b.y,
        d = Math.hypot(dx, dy);
      if (d < b.r + R) {
        const nx = dx / d,
          ny = dy / d;
        ball.x = b.x + nx * (b.r + R);
        ball.y = b.y + ny * (b.r + R);
        const speed = Math.max(7, Math.hypot(ball.vx, ball.vy));
        ball.vx = nx * speed;
        ball.vy = ny * speed;
        b.hit = 10;
        score += 100;
      }
    }
    for (const t of TARGETS)
      if (ball.x - R < t.x + t.w && ball.x + R > t.x && ball.y > t.y && ball.y < t.y + t.h) {
        ball.vx = Math.abs(ball.vx) + 1;
        ball.x = t.x + t.w + R;
        if (!t.hit) score += 250;
        t.hit = 30;
      }
    if (ball.y > 40 && ball.y < 70)
      LANES.forEach((x, i) => {
        if (Math.abs(ball.x - x) < 14 && !lanesLit[i]) {
          lanesLit[i] = true;
          score += 500;
          if (lanesLit.every(Boolean)) {
            score += 5000;
            message = "ALL LANES! +5000";
            flash = 60;
            lanesLit = [false, false, false];
          }
        }
      });
    // speed cap
    const sp = Math.hypot(ball.vx, ball.vy);
    if (sp > 16) {
      ball.vx *= 16 / sp;
      ball.vy *= 16 / sp;
    }
    // Last line of defence: never let the ball leave the cabinet.
    if (ball.x < 12 + R) ((ball.x = 12 + R), (ball.vx = Math.abs(ball.vx) * 0.5));
    if (ball.x > 348 - R) ((ball.x = 348 - R), (ball.vx = -Math.abs(ball.vx) * 0.5));
    if (ball.y < 14 + R) ((ball.y = 14 + R), (ball.vy = Math.abs(ball.vy) * 0.5));
    if (ball.y > H + 30) drain();
  }
  function drain() {
    balls--;
    if (balls <= 0) {
      gameOver = true;
      if (score > best) {
        best = score;
        try {
          localStorage.setItem("nicolo-pinball-best", best);
        } catch {}
      }
      message = "GAME OVER — press SPACE or tap to play again";
    } else message = `Ball ${4 - balls}`;
    resetBall();
  }
  function launch() {
    if (gameOver) return newGame();
    if (ball.inLane && ball.y >= 559) {
      ball.vy = -(13 + plunger * 5);
      message = "";
    }
    plunger = 0;
    charging = false;
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#1a0b3d");
    g.addColorStop(1, "#06021a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // stars
    ctx.fillStyle = "rgba(255,255,255,.5)";
    for (let i = 0; i < 40; i++) ctx.fillRect((i * 97) % W, (i * 53) % 420, 1.5, 1.5);
    // eye logo in the middle
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(165, 330, 60, 30, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(165, 330, 18, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,.25)";
    ctx.font = "700 15px Tahoma, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("NICOLÓ PINBALL", 165, 385);
    // walls
    ctx.lineCap = "round";
    for (const [x1, y1, x2, y2, b] of WALLS) {
      ctx.strokeStyle = b > 1 ? "#ff3ea5" : "#7b5cff";
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 8;
      ctx.lineWidth = b > 1 ? 4 : 3;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    // lanes
    LANES.forEach((x, i) => {
      ctx.fillStyle = lanesLit[i] ? "#ffd23e" : "#3a2a6b";
      ctx.beginPath();
      ctx.arc(x, 82, 5, 0, Math.PI * 2);
      ctx.fill();
    });
    // targets
    for (const t of TARGETS) {
      ctx.fillStyle = t.hit ? "#39ff14" : "#1fbf6a";
      ctx.fillRect(t.x, t.y, t.w, t.h);
      if (t.hit) t.hit--;
    }
    // bumpers
    for (const b of BUMPERS) {
      ctx.shadowColor = b.color;
      ctx.shadowBlur = b.hit ? 25 : 10;
      ctx.fillStyle = b.hit ? "#fff" : b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a0b3d";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      if (b.hit) b.hit--;
    }
    ctx.shadowBlur = 0;
    // plunger
    ctx.fillStyle = "#c9c9d6";
    ctx.fillRect(323, 570 + plunger * 22, 20, 30);
    // flippers
    for (const f of flippers) {
      const t = tip(f);
      ctx.strokeStyle = "#fff";
      ctx.shadowColor = "#33d6ff";
      ctx.shadowBlur = 12;
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(t.x, t.y);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    // ball
    const bg = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 1, ball.x, ball.y, R);
    bg.addColorStop(0, "#fff");
    bg.addColorStop(1, "#8a8aa0");
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, R, 0, Math.PI * 2);
    ctx.fill();
    // HUD
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.font = "700 14px Tahoma, sans-serif";
    ctx.fillText(`SCORE ${score}`, 18, 118);
    ctx.textAlign = "right";
    ctx.fillText(`BALL ${Math.min(3, 4 - balls)}/3`, 310, 118);
    ctx.font = "11px Tahoma, sans-serif";
    ctx.fillText(`BEST ${best}`, 310, 134);
    if (message) {
      ctx.textAlign = "center";
      ctx.font = "700 13px Tahoma, sans-serif";
      ctx.fillStyle = flash && flash-- % 10 < 5 ? "#ffd23e" : "#fff";
      ctx.fillText(message, 165, 300);
    }
  }

  canvas._state = () => ({ ball, score, balls, gameOver }); // handy for testing
  let raf;
  const loop = () => {
    if (!el.isConnected) return;
    if (charging) plunger = Math.min(1, plunger + 0.025);
    if (!windowEl.hidden) {
      for (let i = 0; i < SUB; i++) step();
      draw();
    }
    raf = requestAnimationFrame(loop);
  };
  loop();

  // Controls (only while this window is focused)
  const isActive = () =>
    el.isConnected && windowEl.classList.contains("focused") && !windowEl.hidden;
  const keys = (e, down) => {
    if (!isActive()) return;
    const k = e.key;
    if (["z", "Z", "ArrowLeft", "Shift"].includes(k) && (k !== "Shift" || e.location === 1))
      flippers[0].pressed = down;
    else if (["/", "ArrowRight"].includes(k) || (k === "Shift" && e.location === 2))
      flippers[1].pressed = down;
    else if (k === " " || k === "ArrowDown" || k === "Enter") {
      if (down) {
        if (gameOver) newGame();
        else charging = true;
      } else if (charging) launch();
    } else return;
    e.preventDefault();
  };
  const kd = (e) => keys(e, true),
    ku = (e) => keys(e, false);
  window.addEventListener("keydown", kd);
  window.addEventListener("keyup", ku);
  const pointerSide = (e) => {
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W,
      y = ((e.clientY - r.top) / r.height) * H;
    if (x > 300 && y > 480) return "launch";
    return x < W / 2 ? 0 : 1;
  };
  const active = new Map();
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    if (gameOver) return newGame();
    const side = pointerSide(e);
    active.set(e.pointerId, side);
    if (side === "launch") charging = true;
    else flippers[side].pressed = true;
  });
  const release = (e) => {
    const side = active.get(e.pointerId);
    active.delete(e.pointerId);
    if (side === "launch") launch();
    else if (side !== undefined) flippers[side].pressed = false;
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  windowEl.addEventListener("xp-close", () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("keydown", kd);
    window.removeEventListener("keyup", ku);
  });
}
