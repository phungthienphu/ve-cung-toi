import { World, Vec2, Edge, type Body, type Fixture } from "planck";
import { HILL_MAPS, type HillMapId } from "./hillTypes";
import { hillHeight } from "./hillTerrain";

/** One world and one terrain stream for every car, even when racers spread apart. */
export class HillPhysicsWorld {
  readonly world: World;
  readonly groundFixtures = new Set<Fixture>();
  private chunks = new Map<number, Body>();
  constructor(readonly seed: number, readonly map: HillMapId) { this.world = new World(Vec2(0, -HILL_MAPS[map].gravity)); }
  update(positions: number[]) {
    const wanted = new Set<number>();
    for (const x of positions) for (let chunk = Math.floor((x - 65) / 16); chunk <= Math.ceil((x + 85) / 16); chunk++) wanted.add(chunk);
    for (const [chunk, body] of this.chunks) {
      if (wanted.has(chunk)) continue;
      const fixtures: Fixture[] = [];
      for (let f = body.getFixtureList(); f; f = f.getNext()) fixtures.push(f);
      this.world.destroyBody(body); for (const f of fixtures) this.groundFixtures.delete(f); this.chunks.delete(chunk);
    }
    for (const chunk of wanted) {
      if (this.chunks.has(chunk)) continue;
      const body = this.world.createBody();
      for (let x = chunk * 16; x < (chunk + 1) * 16; x++) {
        const point = (m: number) => Vec2(m, hillHeight(this.seed, m, this.map));
        const edge = new Edge(point(x), point(x + 1)); edge.setPrevVertex(point(x - 1)); edge.setNextVertex(point(x + 2));
        this.groundFixtures.add(body.createFixture(edge, { friction: HILL_MAPS[this.map].friction, filterCategoryBits: 1 }));
      }
      this.chunks.set(chunk, body);
    }
  }
}
