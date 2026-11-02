import { World, Vec2, Edge, type Body, type Fixture } from "planck";
import { HILL_MAPS, type HillMapId } from "./hillTypes";
import { hillDeckHeight, hillDeckPoints, hillHeight, hillSkyRoads } from "./hillTerrain";

/** Sky-road decks are one-way: a car only collides with one from above. */
export const isHillDeck = (fixture: Fixture) => (fixture.getUserData() as { deck?: boolean } | null)?.deck === true;

/** One world and one terrain stream for every car, even when racers spread apart. */
export class HillPhysicsWorld {
  readonly world: World;
  readonly groundFixtures = new Set<Fixture>();
  private chunks = new Map<number, Body>();
  constructor(readonly seed: number, readonly map: HillMapId) {
    this.world = new World(Vec2(0, -HILL_MAPS[map].gravity));
    // Through a deck from below (driving under it, jumping up through it); onto it from above.
    this.world.on("pre-solve", contact => {
      const a = contact.getFixtureA(), b = contact.getFixtureB();
      const deck = isHillDeck(a) ? a : isHillDeck(b) ? b : null;
      if (!deck) return;
      const part = deck === a ? b : a, body = part.getBody(), at = body.getPosition();
      const surface = hillDeckHeight(this.seed, at.x, this.map);
      if (surface === null) return;
      const shape = part.getShape();
      const bottom = shape.getType() === "circle" ? at.y - shape.getRadius() * 0.5 : at.y;
      if (bottom < surface - 0.1) contact.setEnabled(false);
    });
  }
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
      // Sky-road deck edges starting in this chunk.
      for (const road of hillSkyRoads(this.seed, chunk * 16, (chunk + 1) * 16, this.map)) {
        const points = hillDeckPoints(road);
        for (let i = 0; i + 1 < points.length; i++) {
          if (points[i].x < chunk * 16 || points[i].x >= (chunk + 1) * 16) continue;
          const edge = new Edge(Vec2(points[i].x, points[i].y), Vec2(points[i + 1].x, points[i + 1].y));
          if (i > 0) edge.setPrevVertex(Vec2(points[i - 1].x, points[i - 1].y));
          if (i + 2 < points.length) edge.setNextVertex(Vec2(points[i + 2].x, points[i + 2].y));
          this.groundFixtures.add(body.createFixture(edge, { friction: HILL_MAPS[this.map].friction, filterCategoryBits: 1, userData: { deck: true } }));
        }
      }
      this.chunks.set(chunk, body);
    }
  }
}
