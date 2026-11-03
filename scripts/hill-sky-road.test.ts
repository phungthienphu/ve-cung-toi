/** Run: node --import tsx scripts/hill-sky-road.test.ts */
import assert from 'node:assert/strict';
import { Vec2 } from 'planck';
import { HillSim } from '../shared/hill/sim';
import { hillSkyRoads, hillDeckPoints, hillDeckHeight, hillHeight } from '../shared/hill/terrain';
import { HILL_MAPS, type HillMapId } from '../shared/hill/types';

for (const map of Object.keys(HILL_MAPS) as HillMapId[]) {
  const roads = hillSkyRoads(1, 150, 4000, map);
  assert.ok(roads.length, `${map} still has floating roads`);
  for (const road of roads) {
    for (const p of hillDeckPoints(road)) {
      assert.equal(p.y, road.y, 'entire deck stays level, with no descending ramp');
      assert.ok(p.y - hillHeight(1, p.x, map) >= 4, 'lower route has clearance');
    }
    assert.equal(hillDeckHeight(1, road.x1 + .01, map), null, 'deck ends abruptly');
  }
}
const road = hillSkyRoads(1, 150, 4000, 'tea')[0];
const sim = new HillSim(1);
sim.resetAt(road.x1 - 5, road.y);
for (let i = 0; i < 90; i++) sim.step({ gas: false, brake: false });
assert.ok(sim.snapshot().grounded, 'car lands on the floating deck');
for (const body of [sim.chassis, ...sim.wheels]) body.setLinearVelocity(Vec2(10, 0));
let fell = false;
for (let i = 0; i < 100; i++) {
  sim.step({ gas: false, brake: false });
  const s = sim.snapshot();
  if (s.chassis.x > road.x1 + 2 && !s.grounded && s.motion[0].vy < -1 && s.chassis.y < road.y) fell = true;
}
assert.ok(fell, 'car leaves the end and falls freely below deck height');
console.log('Sky roads passed: flat floating decks, lower-route clearance, abrupt end and free fall.');
