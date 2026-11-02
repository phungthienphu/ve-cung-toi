import { World, Vec2, Box, Circle, Edge, WheelJoint, type Body, type Fixture } from "planck";
import { HILL_DT, HILL_JEEP as J, type HillInput, type HillPose, type HillSnapshot, type HillEvent } from "./hillTypes";
import { hillHeight, hillPickups } from "./hillTerrain";

/** Owns physics only. Call step exactly once per fixed tick on any runtime. */
export class HillSim {
  readonly world = new World(Vec2(0, -9.8));
  readonly chassis: Body;
  readonly wheels: Body[];
  private joints: WheelJoint[];
  private ground = new Map<number, Body>();
  private groundFixtures = new Set<Fixture>();
  private wheelContacts = [new Set<Fixture>(), new Set<Fixture>()];
  private roofContacts = new Set<Fixture>();
  private collected = new Set<string>();
  private retiredX = -Infinity;
  private tick = 0;
  private fuel = 100;
  private coins = 0;
  private distance = 0;
  private overturn = 0;
  private overturned = false;
  private stopped = 0;
  private finished: HillSnapshot["finished"] = null;
  private events: HillEvent[] = [];

  constructor(readonly seed: number) {
    this.extendGround(5);
    const groupIndex = -1;
    this.chassis = this.world.createDynamicBody({ position: Vec2(5, 1.55), angularDamping: 0.8 });
    this.chassis.createFixture(Box(1.65, 0.35), { density: 1.5, friction: 0.4, filterGroupIndex: groupIndex });
    this.chassis.createFixture(Box(0.95, 0.38, Vec2(-0.15, 0.65)), { density: 0.8, friction: 0.4, filterGroupIndex: groupIndex });
    const roof = this.chassis.createFixture(Box(0.8, 0.08, Vec2(-0.15, 1.05)), { isSensor: true, filterGroupIndex: groupIndex });
    this.wheels = [-1, 1].map(side => {
      const wheel = this.world.createDynamicBody(Vec2(5 + side * J.wheelbase / 2, 0.65));
      wheel.createFixture(Circle(J.wheelRadius), { density: 1.2, friction: 1.4, filterGroupIndex: groupIndex });
      return wheel;
    });
    this.joints = this.wheels.map(wheel => this.world.createJoint(new WheelJoint({
      enableMotor: true, maxMotorTorque: J.motorTorque, motorSpeed: 0,
      frequencyHz: J.springHz, dampingRatio: J.damping,
    }, this.chassis, wheel, wheel.getPosition(), Vec2(0, 1)))!);
    const contact = (a: Fixture, b: Fixture, begin: boolean) => {
      if (!this.groundFixtures.has(b)) return;
      if (a === roof) {
        if (begin) this.roofContacts.add(b); else this.roofContacts.delete(b);
      }
      this.wheels.forEach((wheel, i) => {
        if (a.getBody() === wheel) {
          if (begin) this.wheelContacts[i].add(b); else this.wheelContacts[i].delete(b);
        }
      });
    };
    this.world.on("begin-contact", c => { contact(c.getFixtureA(), c.getFixtureB(), true); contact(c.getFixtureB(), c.getFixtureA(), true); });
    this.world.on("end-contact", c => { contact(c.getFixtureA(), c.getFixtureB(), false); contact(c.getFixtureB(), c.getFixtureA(), false); });
  }

  private extendGround(x: number) {
    const low = Math.floor((x - 65) / 16);
    const high = Math.ceil((x + 85) / 16);
    for (const [chunk, body] of this.ground) {
      if (chunk >= low && chunk <= high) continue;
      const fixtures: Fixture[] = [];
      for (let f = body.getFixtureList(); f; f = f.getNext()) fixtures.push(f);
      this.world.destroyBody(body);
      for (const fixture of fixtures) this.groundFixtures.delete(fixture);
      this.ground.delete(chunk);
    }
    for (let chunk = low; chunk <= high; chunk++) {
      if (this.ground.has(chunk)) continue;
      const body = this.world.createBody();
      for (let x0 = chunk * 16; x0 < (chunk + 1) * 16; x0++) {
        const edge = new Edge(Vec2(x0, hillHeight(this.seed, x0)), Vec2(x0 + 1, hillHeight(this.seed, x0 + 1)));
        edge.setPrevVertex(Vec2(x0 - 1, hillHeight(this.seed, x0 - 1)));
        edge.setNextVertex(Vec2(x0 + 2, hillHeight(this.seed, x0 + 2)));
        this.groundFixtures.add(body.createFixture(edge, { friction: 1 }));
      }
      this.ground.set(chunk, body);
    }
  }

  step(input: HillInput): void {
    if (this.finished) return;
    this.tick++;
    const direction = Number(input.gas) - Number(input.brake);
    const grounded = this.wheelContacts.some(c => c.size > 0);
    this.joints.forEach(j => {
      j.setMotorSpeed(this.fuel > 0 ? -direction * J.motorSpeed : 0);
      j.setMaxMotorTorque(this.fuel > 0 && direction !== 0 ? J.motorTorque : 0);
    });
    if (!grounded || this.overturned) this.chassis.applyTorque(direction * (this.overturned ? J.recoveryTorque : J.airTorque), true);
    this.extendGround(this.chassis.getPosition().x);
    this.world.step(HILL_DT, 8, 3);
    const p = this.chassis.getPosition();
    this.distance = Math.max(this.distance, p.x - 5);
    this.fuel = Math.max(0, this.fuel - HILL_DT * (J.idleFuelPerSecond + (input.gas ? J.gasFuelPerSecond : 0)));
    for (const pickup of hillPickups(this.seed, p.x - 4, p.x + 4)) {
      if (pickup.x < this.retiredX || this.collected.has(pickup.id) || Math.hypot(pickup.x - p.x, pickup.y - p.y) > 2) continue;
      this.collected.add(pickup.id);
      if (pickup.kind === "fuel") { this.fuel = 100; this.events.push("fuel"); }
      else { this.coins++; this.events.push("coin"); }
    }
    // Retire collected IDs behind the streaming window; revisiting old road never mints coins.
    this.retiredX = Math.max(this.retiredX, p.x - 80);
    if (this.tick % 120 === 0) {
      const nearby = new Set(hillPickups(this.seed, this.retiredX, p.x + 80).map(v => v.id));
      for (const id of this.collected) if (!nearby.has(id)) this.collected.delete(id);
    }
    if (this.roofContacts.size && !this.overturned) { this.overturned = true; this.events.push("overturned"); }
    if (this.overturned) {
      if (this.wheelContacts.every(c => c.size > 0) && Math.cos(this.chassis.getAngle()) > 0.3) {
        this.overturned = false; this.overturn = 0; this.events.push("recovered");
      } else {
        this.overturn += HILL_DT;
        if (this.overturn >= J.overturnSeconds) this.finished = "overturned";
      }
    }
    this.stopped = this.fuel === 0 && this.chassis.getLinearVelocity().length() < 0.35 ? this.stopped + HILL_DT : 0;
    if (this.stopped >= 3) this.finished = "fuel";
    if (this.finished) this.events.push("finished");
  }

  drainEvents(): HillEvent[] { const events = this.events; this.events = []; return events; }
  snapshot(): HillSnapshot {
    const pose = (body: Body): HillPose => ({ x: body.getPosition().x, y: body.getPosition().y, angle: body.getAngle() });
    const x = this.chassis.getPosition().x;
    return {
      tick: this.tick, chassis: pose(this.chassis), wheels: this.wheels.map(pose),
      speed: this.chassis.getLinearVelocity().length(), distance: this.distance, fuel: this.fuel, coins: this.coins,
      grounded: this.wheelContacts.some(c => c.size > 0),
      overturnRemaining: this.overturned ? Math.max(0, J.overturnSeconds - this.overturn) : null,
      finished: this.finished,
      pickups: hillPickups(this.seed, x - 30, x + 85).filter(v => v.x >= this.retiredX && !this.collected.has(v.id)),
    };
  }
}
