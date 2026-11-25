// Maths that gives the same answer, to the last bit, in every browser.
//
// Online battles run the same physics on both players' phones and must stay
// in step. Plain + - * / and Math.sqrt are exact everywhere, but Math.sin,
// Math.cos, Math.pow, Math.hypot and friends may differ in the last digit
// between Chrome and Safari, and the physics grows a tiny difference into a
// different fight. Everything the simulation computes goes through here.

/** cos of 0°, 15°, ... 90°, as fixed literals. */
const C = [1, 0.9659258262890683, 0.8660254037844387, 0.7071067811865476, 0.5, 0.25881904510252074, 0];

/** Cosine of k × 15°, for any integer k. */
export function cos15(k) {
  const q = ((k % 24) + 24) % 24;
  if (q <= 6) return C[q];
  if (q <= 12) return -C[12 - q];
  if (q <= 18) return -C[q - 12];
  return C[24 - q];
}

/** Sine of k × 15°, for any integer k. */
export function sin15(k) {
  return cos15(k - 6);
}

export const SQRT_HALF = 0.7071067811865476;

/** Yaw quarter-turns about +Y as quaternions: +90° and -90°. */
export const YAW_POS = Object.freeze({ x: 0, y: SQRT_HALF, z: 0, w: SQRT_HALF });
export const YAW_NEG = Object.freeze({ x: 0, y: -SQRT_HALF, z: 0, w: SQRT_HALF });

/** cos(55°): past this lean a build counts as knocked over. */
export const COS_55 = 0.573576436351046;

export function hypot2(x, y) {
  return Math.sqrt(x * x + y * y);
}

export function hypot3(x, y, z) {
  return Math.sqrt(x * x + y * y + z * z);
}

const LN2 = 0.6931471805599453;
const f64 = new Float64Array(1);
const u32 = new Uint32Array(f64.buffer);
// Which 32-bit half holds the exponent depends on byte order.
const HI = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1 ? 1 : 0;

/** Natural log for x > 0, built from exact operations only. */
export function detLog(x) {
  if (!(x > 0)) return x === 0 ? -Infinity : NaN;
  if (x === Infinity) return Infinity;
  f64[0] = x;
  let e = ((u32[HI] >>> 20) & 0x7ff) - 1023;
  if (e === -1023) {
    // Subnormal: scale up into the normal range first.
    f64[0] = x * 4503599627370496; // 2^52
    e = ((u32[HI] >>> 20) & 0x7ff) - 1023 - 52;
  }
  // Mantissa in [1, 2).
  u32[HI] = (u32[HI] & 0x800fffff) | 0x3ff00000;
  let m = f64[0];
  // Centre it on 1 so the series converges fast: m in [0.707, 1.414).
  if (m > 1.4142135623730951) {
    m *= 0.5;
    e += 1;
  }
  const s = (m - 1) / (m + 1);
  const s2 = s * s;
  // 2·atanh(s) = 2(s + s³/3 + s⁵/5 + ...); |s| < 0.172, so 11 terms is plenty.
  let term = s;
  let sum = s;
  for (let n = 3; n <= 23; n += 2) {
    term *= s2;
    sum += term / n;
  }
  return e * LN2 + 2 * sum;
}

/** e^y, built from exact operations only. */
export function detExp(y) {
  if (y !== y) return NaN;
  if (y > 709) return Infinity;
  if (y < -745) return 0;
  const k = Math.round(y / LN2);
  const r = y - k * LN2;
  // Taylor series of e^r for |r| <= 0.35.
  let term = 1;
  let sum = 1;
  for (let n = 1; n <= 18; n++) {
    term *= r / n;
    sum += term;
  }
  // Multiply by 2^k exactly, in steps that stay inside the normal range.
  let p = k;
  while (p > 0) {
    const step = Math.min(p, 1000);
    sum *= pow2(step);
    p -= step;
  }
  while (p < 0) {
    const step = Math.max(p, -1000);
    sum *= pow2(step);
    p -= step;
  }
  return sum;
}

/** 2^k for integer k in [-1022, 1023], made straight from the bits. */
function pow2(k) {
  u32[1 - HI] = 0;
  u32[HI] = (k + 1023) << 20;
  return f64[0];
}

/** x^y for x >= 0, the same in every browser. */
export function detPow(x, y) {
  if (x === 0) return y > 0 ? 0 : y === 0 ? 1 : Infinity;
  if (y === 0) return 1;
  if (y === 1) return x;
  if (y === 0.5) return Math.sqrt(x);
  return detExp(y * detLog(x));
}

/**
 * A small FNV-1a hash over numbers (their exact bits) and strings. Both
 * players hash the battle after every turn to check they still agree.
 */
export class StateHash {
  constructor() {
    this.h = 0x811c9dc5;
  }

  byte(b) {
    this.h ^= b & 0xff;
    this.h = Math.imul(this.h, 0x01000193) >>> 0;
  }

  num(x) {
    f64[0] = x;
    const lo = u32[1 - HI];
    const hi = u32[HI];
    for (const w of [lo, hi]) {
      this.byte(w);
      this.byte(w >>> 8);
      this.byte(w >>> 16);
      this.byte(w >>> 24);
    }
    return this;
  }

  str(s) {
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      this.byte(c);
      this.byte(c >>> 8);
    }
    return this;
  }

  hex() {
    return (this.h >>> 0).toString(16).padStart(8, '0');
  }
}
