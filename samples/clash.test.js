// Clash fights: both builds charge at once, the harder charge wins the round,
// and a peg can be spat mid-clash. Replays depend on exact repeatability.

import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import { Battle } from '../src/sim/battle.js';
import { planClash, BOT } from '../src/sim/ai.js';
import { RIVALS, rivalBuild, starterBuilds } from '../src/data/builds.js';
import { makeRng } from '../src/core/rng.js';
import { DT } from '../src/sim/constants.js';

await RAPIER.init();

const config = (rival = 2, seed = 9) => ({
  seed,
  clash: true,
  turns: 10,
  sides: [
    { name: 'Me', parts: starterBuilds()[0].parts },
    { name: RIVALS[rival].name, parts: rivalBuild(rival).parts },
  ],
});

function make(cfg = config()) {
  const b = new Battle(RAPIER, cfg);
  b.start();
  untilAim(b);
  return b;
}

function untilAim(b, max = 30) {
  for (let i = 0; i < max / DT && b.phase !== 'aim' && b.phase !== 'over'; i++) b.update(DT);
}

const round = (b, a, c) => {
  assert.equal(b.clash([a, c]), true);
  b.update(DT);
  untilAim(b);
};

test('a clash sends both builds in at once and the next round starts with nobody taking turns', () => {
  const b = make();
  assert.equal(b.act(0, { type: 'smash', dirX: 1, dirZ: 0, dist: 5 }), false, 'no turn-by-turn shots in a clash fight');
  assert.equal(b.clash([{ power: 0.8 }, { power: 0.8 }]), true);
  assert.equal(b.phase, 'flight');
  const v = b.sides.map((s) => s.core.body.linvel().x);
  assert.ok(v[0] > 5 && v[1] < -5, `both charge at each other (${v})`);
  assert.equal(b.clash([{ power: 1 }, { power: 1 }]), false, 'not again mid-clash');
  b.update(DT);
  untilAim(b);
  if (b.phase !== 'over') {
    assert.equal(b.turn, 1);
    assert.equal(b.turnSide, 0);
    assert.deepEqual(b.stats.shots, [1, 1]);
  }
  b.dispose();
});

test('clash() is refused in a turn-by-turn fight', () => {
  const b = new Battle(RAPIER, { ...config(), clash: false });
  b.start();
  untilAim(b);
  assert.equal(b.clash([{ power: 1 }, { power: 1 }]), false);
  b.dispose();
});

test('the harder charge keeps its pegs, takes ground and ends up pushing the other build out', () => {
  const b = make();
  let outs = 0;
  let line = 0;
  b.on((e) => {
    if (e.type === 'ground') line = Math.max(line, e.line);
    if (e.type === 'knockdown' && e.side === 1 && e.reason === 'ring') outs++;
  });
  for (let i = 0; i < 10 && b.phase !== 'over'; i++) round(b, { power: 1 }, { power: 0.3 });
  assert.equal(b.winner, 0);
  assert.ok(b.stats.popped[1] > b.stats.popped[0], `popped ${b.stats.popped}`);
  assert.ok(line > 1.5 || outs > 0, `ground was taken (line ${line}, outs ${outs})`);
  b.dispose();
});

test('a spit by hand replays exactly when given back as spitAt', () => {
  const a = make();
  a.clash([{ power: 0.9, kind: 0 }, { power: 0.6, kind: 0, spitAt: 30 }]);
  const clash = a.clashing;
  for (let i = 0; i < 20; i++) a.update(DT);
  assert.equal(a.spit(0), true);
  assert.equal(a.spit(0), false, 'one peg a clash');
  untilAim(a);
  assert.deepEqual(clash.log.map((l) => l.side).sort(), [0, 1]);

  const b = make();
  const at = (side) => clash.log.find((l) => l.side === side).at;
  b.clash([{ power: 0.9, kind: 0, spitAt: at(0) }, { power: 0.6, kind: 0, spitAt: at(1) }]);
  b.update(DT);
  untilAim(b);
  assert.equal(b.hash(), a.hash());
  a.dispose();
  b.dispose();
});

test('a saved clash fight carries on exactly as the original does', () => {
  const cfg = config(4, 21);
  const a = make(cfg);
  round(a, { power: 1 }, { power: 0.5 });
  assert.notEqual(a.line, 0);
  const b = Battle.fromState(RAPIER, cfg, a.exportState());
  assert.equal(b.line, a.line);
  assert.equal(b.sides[1].spawn.x, a.sides[1].spawn.x);
  for (const x of [a, b]) round(x, { power: 0.7, spitAt: 12 }, { power: 0.9, spitAt: 40 });
  assert.equal(b.hash(), a.hash());
  a.dispose();
  b.dispose();
});

test('rivals plan a whole clash: a charge within range, a peg they own, and a spit time or none', () => {
  const b = make({ ...config(), sides: config().sides.map((s, i) => ({ ...s, ai: i ? RIVALS[2].ai : BOT })) });
  const rng = makeRng(5);
  for (let i = 0; i < 50; i++) {
    const p = planClash(b, 1, RIVALS[2].ai, rng);
    assert.ok(p.power >= 0.2 && p.power <= 1);
    assert.ok(Number.isInteger(p.kind));
    assert.ok(p.spitAt === null || (Number.isInteger(p.spitAt) && p.spitAt >= 8));
  }
  b.dispose();
});
