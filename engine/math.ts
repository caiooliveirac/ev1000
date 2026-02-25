export const clamp = (value: number, min: number, max: number): number => {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
};

export const sigmoid = (x: number, mid: number, slope: number): number => {
  return 1 / (1 + Math.exp(-(x - mid) / slope));
};

export const lerp = (a: number, b: number, t: number): number => {
  return a + (b - a) * t;
};

export const hillSaturation = (pao2: number, p50 = 26.8, n = 2.7): number => {
  const p = Math.max(1, pao2);
  const pn = Math.pow(p, n);
  const p50n = Math.pow(p50, n);
  return pn / (pn + p50n);
};

export const nextMulberry32 = (state: number): { value: number; state: number } => {
  let t = state + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const next = (t ^ (t >>> 14)) >>> 0;
  return {
    value: next / 4294967296,
    state: next
  };
};

export const jitter = (state: number, amount: number): { value: number; state: number } => {
  const random = nextMulberry32(state);
  return {
    value: (random.value - 0.5) * 2 * amount,
    state: random.state
  };
};
