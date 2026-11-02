import { World, Vec2, Box, Circle, Edge, WheelJoint, type Body, type Fixture } from "planck";
import { HILL_DT, HILL_JEEP as J, type HillInput, type HillPose, type HillSnapshot, type HillEvent, HILL_VEHICLES, HILL_MAPS, type HillOptions, type HillVehicle, type HillMapId, type HillVehicleId, HILL_DASH } from "./hillTypes";
import { hillHeight, hillPickups } from "./hillTerrain";

/** Owns physics only. Call step exactly once per fixed tick on any runtime. */
export class HillSim {
  readonly world: World;
  readonly map: HillMapId;
  readonly vehicle: HillVehicleId;
  readonly config: HillVehicle;
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
  private energy = 100;
  private skillCoins = 0;
  private lastGrounded = 0;
  private lastJump = -60;
  private jumpHeld = false;
  private dashHeld = false;
  private lastDash = -120;
  private takeoffAngle = 0;
  private airTime = 0;
  private airAwarded = 0;
  private pendingLanding = 0;
  private lastWheelTouch = [-999, -999];
  private events: HillEvent[] = [];

  constructor(readonly seed: number, options: HillOptions = {}) {
    this.map = options.map ?? "tea";
    this.vehicle = options.vehicle ?? "jeep";
    this.config = HILL_VEHICLES[this.vehicle];
    const J = this.config;
    this.world = new World(Vec2(0, -HILL_MAPS[this.map].gravity));
    this.extendGround(5);
    const groupIndex = -1;
    this.chassis = this.world.createDynamicBody({ position: Vec2(5, J.wheelRadius + 1), angularDamping: 0.8, linearDamping: 0.08 });
    this.chassis.createFixture(Box(J.halfWidth, 0.35), { density: J.density, friction: 0.4, filterGroupIndex: groupIndex });
    this.chassis.createFixture(Box(J.cabinWidth, 0.38, Vec2(-0.15, 0.65)), { density: J.density * 0.53, friction: 0.4, filterGroupIndex: groupIndex });
    const roof = this.chassis.createFixture(Box(J.cabinWidth - 0.15, 0.08, Vec2(-0.15, 1.05)), { isSensor: true, filterGroupIndex: groupIndex });
    this.wheels = [-1, 1].map(side => {
      const wheel = this.world.createDynamicBody({ position: Vec2(5 + side * J.wheelbase / 2, J.wheelRadius + 0.1), linearDamping: 0.04, angularDamping: 0.08 });
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
          if (begin) { this.wheelContacts[i].add(b); this.lastWheelTouch[i] = this.tick; } else this.wheelContacts[i].delete(b);
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
        const edge = new Edge(Vec2(x0, hillHeight(this.seed, x0, this.map)), Vec2(x0 + 1, hillHeight(this.seed, x0 + 1, this.map)));
        edge.setPrevVertex(Vec2(x0 - 1, hillHeight(this.seed, x0 - 1, this.map)));
        edge.setNextVertex(Vec2(x0 + 2, hillHeight(this.seed, x0 + 2, this.map)));
        this.groundFixtures.add(body.createFixture(edge, { friction: HILL_MAPS[this.map].friction }));
      }
      this.ground.set(chunk, body);
    }
  }

  step(input: HillInput): void {
    if (this.finished) return;
    this.tick++;
    const V = this.config;
    const direction = Number(input.gas) - Number(input.brake);
    const grounded = this.wheelContacts.some(c => c.size > 0);
    this.joints.forEach(j => {
      j.setMotorSpeed(this.fuel > 0 ? -direction * V.motorSpeed : 0);
      j.setMaxMotorTorque((this.fuel > 0 && direction !== 0) || (this.fuel === 0 && input.brake) ? V.motorTorque * Math.max(0.2, HILL_MAPS[this.map].gravity / 9.8) : 0);
    });
    if (!grounded || this.overturned) this.chassis.applyTorque(direction * (this.overturned ? V.recoveryTorque : V.airTorque), true);
    if (grounded) this.lastGrounded = this.tick;
    if (input.jump && !this.jumpHeld && this.energy >= 35 && this.tick - this.lastJump >= 36 && (this.overturned || this.tick - this.lastGrounded <= 9)) {
      this.energy -= 35; this.lastJump = this.tick; this.lastGrounded = -999;
      const rescue = this.overturned;
      for (const body of [this.chassis, ...this.wheels]) {
        body.applyLinearImpulse(Vec2(body.getMass() * (rescue ? 0 : 1.5), body.getMass() * (rescue ? 5.5 : 6.5)), body.getWorldCenter(), true);
        if (rescue) {
          const angle = Math.atan2(Math.sin(this.chassis.getAngle()), Math.cos(this.chassis.getAngle()));
          body.setAngularVelocity(angle > 0 ? -6 : 6);
        }
      }
      this.events.push("jump");
    }
    if (input.dash && !this.dashHeld && this.energy >= HILL_DASH.energy && this.tick - this.lastDash >= HILL_DASH.cooldownTicks && this.fuel > 0 && Math.cos(this.chassis.getAngle()) > 0.3) {
      const boost = Math.max(0, Math.min(HILL_DASH.speedBoost, HILL_DASH.maxSpeed - this.chassis.getLinearVelocity().x));
      if (boost > 0) {
        this.energy -= HILL_DASH.energy; this.lastDash = this.tick;
        for (const body of [this.chassis, ...this.wheels]) body.applyLinearImpulse(Vec2(body.getMass() * boost, 0), body.getWorldCenter(), true);
        this.events.push("dash");
      }
    }
    this.dashHeld = !!input.dash;
    this.jumpHeld = !!input.jump;
    this.extendGround(this.chassis.getPosition().x);
    this.world.step(HILL_DT, 8, 3);
    const p = this.chassis.getPosition();
    this.distance = Math.max(this.distance, p.x - 5);
    const nowGrounded = this.wheelContacts.some(c => c.size > 0);
    this.energy = Math.min(100, this.energy + HILL_DT * (nowGrounded ? 2 : 6));
    if (!nowGrounded) {
      if (grounded || this.airTime === 0) { this.takeoffAngle = this.chassis.getAngle(); this.airAwarded = 0; }
      this.airTime += HILL_DT;
      if (this.airTime > 1.5) {
        const earned = Math.floor(this.airTime * 2), extra = earned - this.airAwarded;
        if (extra > 0) {
          if (this.airAwarded === 0) this.reward("airtime", extra);
          else { this.coins += extra; this.skillCoins += extra; }
          this.airAwarded = earned;
        }
      }
    } else if (this.airTime > 0) {
      const turns = Math.floor((Math.abs(this.chassis.getAngle() - this.takeoffAngle) + 0.1) / (Math.PI * 2));
      if (turns && Math.cos(this.chassis.getAngle()) > 0.3) { this.energy = Math.min(100, this.energy + 25 * turns); this.reward(this.chassis.getAngle() > this.takeoffAngle ? "backflip" : "flip", 10 * turns); }
      if (this.airTime > 0.4) this.pendingLanding = this.tick + 6;
      this.airTime = 0;
    }
    if (this.pendingLanding) {
      if (this.tick > this.pendingLanding) this.pendingLanding = 0;
      else if (this.wheelContacts.every(c => c.size > 0) && Math.abs(this.lastWheelTouch[0] - this.lastWheelTouch[1]) <= 6) {
        this.reward("landing", 2); this.pendingLanding = 0;
      }
    }
    this.fuel = Math.max(0, this.fuel - HILL_DT * (J.idleFuelPerSecond + (input.gas ? J.gasFuelPerSecond : 0)) * V.fuelRate * HILL_MAPS[this.map].fuelRate);
    for (const pickup of hillPickups(this.seed, p.x - 4, p.x + 4, this.map)) {
      if (pickup.x < this.retiredX || this.collected.has(pickup.id) || Math.hypot(pickup.x - p.x, pickup.y - p.y) > 2) continue;
      this.collected.add(pickup.id);
      if (pickup.kind === "fuel") { this.fuel = 100; this.events.push("fuel"); }
      else if (pickup.kind === "energy") { this.energy = Math.min(100, this.energy + 40); this.events.push("energy"); }
      else { this.coins++; this.events.push("coin"); }
    }
    // Retire collected IDs behind the streaming window; revisiting old road never mints coins.
    this.retiredX = Math.max(this.retiredX, p.x - 80);
    if (this.tick % 120 === 0) {
      const nearby = new Set(hillPickups(this.seed, this.retiredX, p.x + 80, this.map).map(v => v.id));
      for (const id of this.collected) if (!nearby.has(id)) this.collected.delete(id);
    }
    if (this.roofContacts.size && !this.overturned) { this.overturned = true; this.events.push("overturned"); }
    if (this.overturned) {
      if (this.wheelContacts.every(c => c.size > 0) && Math.cos(this.chassis.getAngle()) > 0.3) {
        this.overturned = false; this.overturn = 0; this.reward("recovered", 3);
      } else {
        this.overturn += HILL_DT;
        if (this.overturn >= J.overturnSeconds) this.finished = "overturned";
      }
    }
    this.stopped = this.fuel === 0 && this.chassis.getLinearVelocity().length() < 0.35 ? this.stopped + HILL_DT : 0;
    if (this.stopped >= 3) this.finished = "fuel";
    if (this.finished) this.events.push("finished");
  }

  private reward(event: HillEvent, coins: number) { this.coins += coins; this.skillCoins += coins; this.events.push(event); }

  drainEvents(): HillEvent[] { const events = this.events; this.events = []; return events; }
  snapshot(): HillSnapshot {
    const pose = (body: Body): HillPose => ({ x: body.getPosition().x, y: body.getPosition().y, angle: body.getAngle() });
    const x = this.chassis.getPosition().x;
    return {
      tick: this.tick, map: this.map, vehicle: this.vehicle, energy: this.energy, skillCoins: this.skillCoins,
      dashReady: this.energy >= HILL_DASH.energy && this.tick - this.lastDash >= HILL_DASH.cooldownTicks && this.fuel > 0 && Math.cos(this.chassis.getAngle()) > 0.3,
      dashCooldown: Math.max(0, (HILL_DASH.cooldownTicks - (this.tick - this.lastDash)) * HILL_DT),
      jumpReady: this.energy >= 35 && this.tick - this.lastJump >= 36 && (this.overturned || this.tick - this.lastGrounded <= 9), chassis: pose(this.chassis), wheels: this.wheels.map(pose),
      speed: this.chassis.getLinearVelocity().length(), distance: this.distance, fuel: this.fuel, coins: this.coins,
      grounded: this.wheelContacts.some(c => c.size > 0),
      overturnRemaining: this.overturned ? Math.max(0, J.overturnSeconds - this.overturn) : null,
      finished: this.finished,
      pickups: hillPickups(this.seed, x - 30, x + 85, this.map).filter(v => v.x >= this.retiredX && !this.collected.has(v.id)),
    };
  }
}
