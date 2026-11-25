/**
 * Small seeded random number generator (mulberry32). Its numbers are the same
 * in every browser, and its state can be saved and restored with the battle.
 */
export function makeRng(seed = Date.now()) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.state = () => a;
  next.setState = (s) => { a = s >>> 0; };
  next.gauss = () => {
    let u = 0;
    let v = 0;
    while (u === 0) u = next();
    while (v === 0) v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  next.pick = (arr) => arr[Math.floor(next() * arr.length) % arr.length];
  return next;
}
