/**
 * Color utilities for the hemodynamic diagram.
 * Pure functions, no React dependency — safe to import anywhere.
 */

export const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

export const lerp = (a: number, b: number, t: number) =>
  a + (b - a) * clamp(t, 0, 1);

export const remap = (
  v: number, inLo: number, inHi: number, outLo: number, outHi: number,
) => lerp(outLo, outHi, (v - inLo) / (inHi - inLo));

/**
 * Green→Yellow→Red continuous color based on 0–1 severity.
 * 0 = normal (green), 0.5 = alert (yellow), 1 = critical (red).
 */
export const severityColor = (severity: number): string => {
  const s = clamp(severity, 0, 1);
  if (s < 0.5) {
    const r = Math.round(lerp(109, 248, s * 2));
    const g = Math.round(lerp(227, 192, s * 2));
    const b = Math.round(lerp(142, 95, s * 2));
    return `rgb(${r},${g},${b})`;
  }
  const t = (s - 0.5) * 2;
  const r = Math.round(lerp(248, 247, t));
  const g = Math.round(lerp(192, 118, t));
  const b = Math.round(lerp(95, 109, t));
  return `rgb(${r},${g},${b})`;
};

/** Same as severityColor but with alpha channel (for backgrounds/borders). */
export const severityAlpha = (severity: number, alpha: number = 0.5): string => {
  const s = clamp(severity, 0, 1);
  if (s < 0.5) {
    const r = Math.round(lerp(109, 248, s * 2));
    const g = Math.round(lerp(227, 192, s * 2));
    const b = Math.round(lerp(142, 95, s * 2));
    return `rgba(${r},${g},${b},${alpha})`;
  }
  const t = (s - 0.5) * 2;
  const r = Math.round(lerp(248, 247, t));
  const g = Math.round(lerp(192, 118, t));
  const b = Math.round(lerp(95, 109, t));
  return `rgba(${r},${g},${b},${alpha})`;
};

/** Derive arterial red hue from SaO₂ brightness (0–1). */
export const arteryHue = (sao2Brightness: number) =>
  `hsl(${lerp(0, 5, sao2Brightness)}, ${lerp(55, 78, sao2Brightness)}%, ${lerp(40, 55, sao2Brightness)}%)`;

/** Derive venous blue hue from SvO₂ severity (0–1). */
export const veinHue = (svo2Severity: number) =>
  `hsl(${lerp(215, 220, 1 - svo2Severity)}, ${lerp(35, 55, 1 - svo2Severity)}%, ${lerp(32, 48, 1 - svo2Severity)}%)`;
