import { Vec2, Box, Circle, WheelJoint, type Body, type Fixture, type World } from "planck";
import { HILL_DT, HILL_JEEP as J, type HillInput, type HillPose, type HillSnapshot, type HillEvent, HILL_VEHICLES, HILL_MAPS, type HillOptions, type HillVehicle, type HillMapId, type HillVehicleId, HILL_DASH } from "./hillTypes";
import { hillDeckHeight, hillHeight, hillPickups, hillWaterLevel } from "./hillTerrain";

import { HillPhysicsWorld, isHillDeck } from "./hillWorld";

/** Water slows a car by this fraction of its speed per second (the owner asked for 1–2%). */
const WATER_DRAG = 0.02;

/** Owns physics only. Call step exactly once per fixed tick on any runtime. */
export class HillSim {
  readonly world: World;
  readonly map: HillMapId;
  readonly vehicle: HillVehicleId;
  readonly config: HillVehicle;
  readonly raceFuel: boolean;
  readonly chassis: Body;
  readonly wheels: Body[];
  private joints: WheelJoint[];
  readonly physics: HillPhysicsWorld;
  private groundFixtures: Set<Fixture>;
  private standalone: boolean;
  private wasGrounded = false;
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

  constructor(readonly seed: number, options: HillOptions = {}, physics?: HillPhysicsWorld, readonly slot = 0) {
    this.raceFuel = options.raceFuel ?? false;
    this.map = options.map ?? "tea";
    this.vehicle = options.vehicle ?? "jeep";
    this.config = HILL_VEHICLES[this.vehicle];
    const J = this.config;
    this.standalone = !physics;
    this.physics = physics ?? new HillPhysicsWorld(seed, this.map);
    this.world = this.physics.world; this.groundFixtures = this.physics.groundFixtures;
    if (this.standalone) this.physics.update([5]);
    const groupIndex = -(slot + 1);
    this.chassis = this.world.createDynamicBody({ position: Vec2(5, J.wheelRadius + 1), angularDamping: 0.8, linearDamping: 0.08 });
    this.chassis.createFixture(Box(J.halfWidth, 0.35), { density: J.density, friction: 0.4, filterGroupIndex: groupIndex, filterCategoryBits: 2 });
    this.chassis.createFixture(Box(J.cabinWidth, 0.38, Vec2(-0.15, 0.65)), { density: J.density * 0.53, friction: 0.4, filterGroupIndex: groupIndex, filterCategoryBits: 2 });
    const roof = this.chassis.createFixture(Box(J.cabinWidth - 0.15, 0.08, Vec2(-0.15, 1.05)), { isSensor: true, filterGroupIndex: groupIndex, filterCategoryBits: 2 });
    this.wheels = [-1, 1].map(side => {
      const wheel = this.world.createDynamicBody({ position: Vec2(5 + side * J.wheelbase / 2, J.wheelRadius + 0.1), linearDamping: 0.04, angularDamping: 0.08 });
      wheel.createFixture(Circle(J.wheelRadius), { density: 1.2, friction: 1.4, filterGroupIndex: groupIndex, filterCategoryBits: 2 });
      return wheel;
    });
    this.joints = this.wheels.map(wheel => this.world.createJoint(new WheelJoint({
      enableMotor: true, maxMotorTorque: J.motorTorque, motorSpeed: 0,
      frequencyHz: J.springHz, dampingRatio: J.damping,
    }, this.chassis, wheel, wheel.getPosition(), Vec2(0, 1)))!);
    roof.setUserData({ hillSlot: slot, part: "roof" });
    for (const body of [this.chassis, ...this.wheels]) body.setUserData({ hillSlot: slot });
    const contact = (a: Fixture, b: Fixture, begin: boolean) => {
      const ground = this.groundFixtures.has(b);
      const other = b.getBody().getUserData() as { hillSlot?: number } | null;
      if (!ground && (other?.hillSlot === undefined || other.hillSlot === slot || b.isSensor())) return;
      if (a === roof && ground) {
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

  step(input: HillInput): void {
    if (this.finished) return;
    this.prepareStep(input);
    if (this.standalone) this.physics.update([this.chassis.getPosition().x]);
    this.world.step(HILL_DT, 8, 3); this.finishStep(input);
  }

  prepareStep(input: HillInput): void {
    if (this.finished) return;
    this.tick++;
    const V = this.config;
    const direction = Number(input.gas) - Number(input.brake);
    const grounded = this.anyWheelDown(); this.wasGrounded = grounded;
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
  }

  finishStep(input: HillInput): void {
    if (this.finished) return;
    const grounded = this.wasGrounded, V = this.config;
    const p = this.chassis.getPosition();
    this.distance = Math.max(this.distance, p.x - 5);
    const water = hillWaterLevel(this.seed, p.x, this.map);
    if (water !== null && this.wheels.some(w => w.getPosition().y - V.wheelRadius < water)) {
      const keep = 1 - WATER_DRAG * HILL_DT;
      for (const b of [this.chassis, ...this.wheels]) { const v = b.getLinearVelocity(); b.setLinearVelocity(Vec2(v.x * keep, v.y)); }
    }
    const nowGrounded = this.anyWheelDown();
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
      else if (this.bothWheelsDown() && Math.abs(this.lastWheelTouch[0] - this.lastWheelTouch[1]) <= 6) {
        this.reward("landing", 2); this.pendingLanding = 0;
      }
    }
    this.fuel = Math.max(0, this.fuel - HILL_DT * (J.idleFuelPerSecond + (input.gas ? J.gasFuelPerSecond : 0)) * V.fuelRate * HILL_MAPS[this.map].fuelRate);
    for (const pickup of hillPickups(this.seed, p.x - 4, p.x + 4, this.map, this.raceFuel)) {
      if (pickup.x < this.retiredX || this.collected.has(pickup.id) || Math.hypot(pickup.x - p.x, pickup.y - p.y) > 2) continue;
      this.collected.add(pickup.id);
      if (pickup.kind === "fuel") { this.fuel = 100; this.events.push("fuel"); }
      else if (pickup.kind === "energy") { this.energy = Math.min(100, this.energy + 40); this.events.push("energy"); }
      else { this.coins++; this.events.push("coin"); }
    }
    // Retire collected IDs behind the streaming window; revisiting old road never mints coins.
    this.retiredX = Math.max(this.retiredX, p.x - 80);
    if (this.tick % 120 === 0) {
      const nearby = new Set(hillPickups(this.seed, this.retiredX, p.x + 80, this.map, this.raceFuel).map(v => v.id));
      for (const id of this.collected) if (!nearby.has(id)) this.collected.delete(id);
    }
    if (this.roofDown() && !this.overturned) { this.overturned = true; this.events.push("overturned"); }
    if (this.overturned) {
      if (this.bothWheelsDown() && Math.cos(this.chassis.getAngle()) > 0.3) {
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

  setGhost(ghost: boolean) {
    for (const body of [this.chassis, ...this.wheels]) for (let f = body.getFixtureList(); f; f = f.getNext()) f.setFilterMaskBits(ghost ? 1 : 0xffff);
  }
  setActive(active: boolean) { for (const b of [this.chassis, ...this.wheels]) b.setActive(active); }
  addEnergy(amount: number) { this.energy = Math.min(100, Math.max(0, this.energy + amount)); }
  setFuel(value: number) { this.fuel = Math.max(0, Math.min(100, value)); }
  resetAt(x: number, y: number, angle = 0) {
    const radius = this.config.wheelRadius;
    this.chassis.setTransform(Vec2(x, y + radius + 1), angle);
    this.wheels.forEach((w, i) => w.setTransform(Vec2(x + (i ? 1 : -1) * this.config.wheelbase / 2, y + radius + 0.1), angle));
    for (const b of [this.chassis, ...this.wheels]) { b.setLinearVelocity(Vec2(0, 0)); b.setAngularVelocity(0); b.setAwake(true); }
    this.finished = null; this.overturned = false; this.overturn = 0; this.stopped = 0; this.jumpHeld = false; this.dashHeld = false; this.airTime = 0; this.pendingLanding = 0;
    this.roofContacts.clear(); this.wheelContacts.forEach(c => c.clear());
  }
  restore(state: HillSnapshot) {
    [this.chassis, ...this.wheels].forEach((b, i) => {
      const pose = i ? state.wheels[i - 1] : state.chassis;
      const motion = state.motion[i]; b.setTransform(Vec2(pose.x, pose.y), pose.angle);
      b.setLinearVelocity(Vec2(motion.vx, motion.vy)); b.setAngularVelocity(motion.omega);
    });
    this.jumpHeld = state.held?.jump ?? false; this.dashHeld = state.held?.dash ?? false;
    this.tick = state.tick; this.fuel = state.fuel; this.energy = state.energy; this.coins = state.coins;
    this.distance = state.distance; this.skillCoins = state.skillCoins; this.finished = state.finished;
    this.overturned = state.overturnRemaining !== null; this.overturn = this.overturned ? 3 - state.overturnRemaining! : 0;
    this.lastDash = this.tick - 120 + state.dashCooldown / HILL_DT;
    this.lastJump = this.tick - 36 + state.jumpCooldown / HILL_DT;
    this.lastGrounded = state.grounded ? this.tick : this.tick - 10;
    this.events = [];
  }

  /** A deck only counts as ground for a part on top of it: under one, or jumping up through it, the car is still in the air. */
  private onTop(fixture: Fixture, body: Body, lift: number) {
    if (!isHillDeck(fixture)) return true;
    const at = body.getPosition(), deck = hillDeckHeight(this.seed, at.x, this.map);
    return deck === null || at.y >= deck + lift;
  }
  private wheelDown(i: number) {
    for (const f of this.wheelContacts[i]) if (this.onTop(f, this.wheels[i], this.config.wheelRadius * 0.5 - 0.1)) return true;
    return false;
  }
  private anyWheelDown() { return this.wheelDown(0) || this.wheelDown(1); }
  private bothWheelsDown() { return this.wheelDown(0) && this.wheelDown(1); }
  /** Roof on the ground (or upside down on a deck) — not merely brushing a deck's underside. */
  private roofDown() {
    for (const f of this.roofContacts) if (this.onTop(f, this.chassis, -0.5)) return true;
    return false;
  }

  private reward(event: HillEvent, coins: number) { this.coins += coins; this.skillCoins += coins; this.events.push(event); }

  drainEvents(): HillEvent[] { const events = this.events; this.events = []; return events; }
  snapshot(): HillSnapshot {
    const pose = (body: Body): HillPose => ({ x: body.getPosition().x, y: body.getPosition().y, angle: body.getAngle() });
    const x = this.chassis.getPosition().x;
    return {
      tick: this.tick, held: { jump: this.jumpHeld, dash: this.dashHeld }, raceFuel: this.raceFuel, motion: [this.chassis, ...this.wheels].map(b => ({ vx: b.getLinearVelocity().x, vy: b.getLinearVelocity().y, omega: b.getAngularVelocity() })),
      jumpCooldown: Math.max(0, (36 - (this.tick - this.lastJump)) * HILL_DT), map: this.map, vehicle: this.vehicle, energy: this.energy, skillCoins: this.skillCoins,
      dashReady: this.energy >= HILL_DASH.energy && this.tick - this.lastDash >= HILL_DASH.cooldownTicks && this.fuel > 0 && Math.cos(this.chassis.getAngle()) > 0.3,
      dashCooldown: Math.max(0, (HILL_DASH.cooldownTicks - (this.tick - this.lastDash)) * HILL_DT),
      jumpReady: this.energy >= 35 && this.tick - this.lastJump >= 36 && (this.overturned || this.tick - this.lastGrounded <= 9), chassis: pose(this.chassis), wheels: this.wheels.map(pose),
      speed: this.chassis.getLinearVelocity().length(), distance: this.distance, fuel: this.fuel, coins: this.coins,
      grounded: this.anyWheelDown(),
      overturnRemaining: this.overturned ? Math.max(0, J.overturnSeconds - this.overturn) : null,
      finished: this.finished,
      pickups: hillPickups(this.seed, x - 30, x + 85, this.map, this.raceFuel).filter(v => v.x >= this.retiredX && !this.collected.has(v.id)),
    };
  }
}
