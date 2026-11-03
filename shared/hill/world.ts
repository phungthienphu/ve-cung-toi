import { World, Vec2, Edge, type Body, type Contact, type Fixture } from "planck";
import { HILL_MAPS, type HillMapId } from "./types";
import { hillDeckHeight, hillDeckPoints, hillHeight, hillSkyRoad, hillSkyRoads } from "./terrain";

/** Sky-road decks are one-way: a car only collides with one from above. */
export const isHillDeck = (fixture: Fixture) => (fixture.getUserData() as { deck?: boolean } | null)?.deck === true;
const deckSection = (fixture: Fixture) => (fixture.getUserData() as { section?: number } | null)?.section;

/** One world and one terrain stream for every car, even when racers spread apart. */
export class HillPhysicsWorld {
  readonly world: World;
  readonly groundFixtures = new Set<Fixture>();
  private chunks = new Map<number, Body>();
  /**
   * Which side of each sky road a car part is on, decided when it first
   * touches that road and kept until it touches none of it: a car that drove
   * under a deck stays "below" all the way out, even where the deck slopes
   * down past its middle (judging every frame afresh turned that slope into a
   * wedge that trapped cars under the far end). Per body, per road.
   */
  private sides = new Map<Body, Map<number, { above: boolean; touching: number }>>();

  constructor(readonly seed: number, readonly map: HillMapId) {
    this.world = new World(Vec2(0, -HILL_MAPS[map].gravity));
    this.world.on("begin-contact", contact => this.touch(contact, 1));
    this.world.on("end-contact", contact => this.touch(contact, -1));
    // Through a deck from below (driving under it, jumping up through it); onto it from above.
    this.world.on("pre-solve", contact => {
      const pair = this.deckPair(contact);
      if (pair && !this.deckAbove(pair.part, pair.deck)) contact.setEnabled(false);
    });
  }

  /** Is this car part on top of that deck (so it stands on it), rather than under it or passing through? */
  deckAbove(part: Fixture, deck: Fixture): boolean {
    const section = deckSection(deck);
    const known = section === undefined ? undefined : this.sides.get(part.getBody())?.get(section);
    return known ? known.above : this.aboveNow(part);
  }

  private aboveNow(part: Fixture) {
    const at = part.getBody().getPosition(), surface = hillDeckHeight(this.seed, at.x, this.map);
    if (surface === null) return true;
    const shape = part.getShape();
    const bottom = shape.getType() === "circle" ? at.y - shape.getRadius() * 0.5 : at.y;
    return bottom >= surface - 0.1;
  }

  private deckPair(contact: Contact) {
    const a = contact.getFixtureA(), b = contact.getFixtureB();
    if (isHillDeck(a) && !isHillDeck(b)) return { deck: a, part: b };
    if (isHillDeck(b) && !isHillDeck(a)) return { deck: b, part: a };
    return null;
  }

  private touch(contact: Contact, delta: number) {
    const pair = this.deckPair(contact);
    if (!pair) return;
    const section = deckSection(pair.deck);
    if (section === undefined) return;
    const body = pair.part.getBody();
    let roads = this.sides.get(body);
    if (!roads) this.sides.set(body, (roads = new Map()));
    let side = roads.get(section);
    if (!side) {
      if (delta < 0) return;
      side = { above: this.aboveNow(pair.part), touching: 0 };
      roads.set(section, side);
    }
    side.touching += delta;
    if (side.touching <= 0) roads.delete(section);
  }

  update(positions: number[]) {
    // Forget sides for roads every car has left behind (their deck chunks are about to go).
    const behind = Math.min(...positions) - 70;
    for (const roads of this.sides.values()) for (const section of roads.keys()) if ((hillSkyRoad(this.seed, section, this.map)?.x1 ?? -Infinity) < behind) roads.delete(section);
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
          this.groundFixtures.add(body.createFixture(edge, { friction: HILL_MAPS[this.map].friction, filterCategoryBits: 1, userData: { deck: true, section: road.section } }));
        }
      }
      this.chunks.set(chunk, body);
    }
  }
}
