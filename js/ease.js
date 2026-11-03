// CSS-style cubic-bezier easing: (x1, y1, x2, y2) → a function of progress 0…1.
export function bezier(x1, y1, x2, y2) {
  const at = (t, a, b) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      // Newton's method: find the t whose curve x matches the progress.
      const err = at(t, x1, x2) - x;
      const slope = 3 * x1 * (1 - t) ** 2 + 6 * (x2 - x1) * t * (1 - t) + 3 * (1 - x2) * t * t;
      if (Math.abs(err) < 1e-5 || !slope) break;
      t -= err / slope;
    }
    return at(t, y1, y2);
  };
}
