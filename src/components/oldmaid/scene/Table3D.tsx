"use client";

import { PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { DEAL_MS, MAX_SEATS, OPENING_PAIRS_MS, SKILL_SHOW_MS, seatAfter, seatBefore, type Emote, type PublicOldMaidState } from "@shared/oldMaidTypes";
import type { LiveEmote, LoggedEvent } from "@/lib/useOldMaidRoom";
import { CARD_H, EYE_Y, FAN_R, FAN_Y, SEAT_R, TABLE_R, TABLE_TOP, cardGeometry, faceMaterial, getBackMaterial, onCircle, seatAngle } from "./cards3d";
import { Fan, fanPose, type FanOffer } from "./Fan";
import { PigAvatar, SEAT_COLORS, type AvatarStatus } from "./PigAvatar";
import { Label } from "./Label";

// The 3D table. Seats have fixed places; the camera lives behind yours and
// swings round the table (never through it) when you change seats or the
// action moves. It only goes first person for your own draw: the hand you draw
// from floats up in front of your eyes. When your hand is drawn from, the view
// stays yours (your face-up hand at the bottom shows where they're pointing).
// Anyone else's draw you watch from across the table, so both pigs are in
// shot with the hand held out between them, the drawer's pointer lighting up
// its cards live. A drawn card then stays in the drawer's fingers while they
// check it against their hand ("dò lá"), before the pair is thrown down to the
// felt or the card slipped in.

export type Quality = "high" | "low";

export interface LobbyControls {
  isHost: boolean;
  mySeat: number | null;
  onSit: (seat: number) => void;
  onAddBot: (seat: number) => void;
  onRemoveBot: (playerId: string) => void;
}

export interface Table3DProps {
  state: PublicOldMaidState;
  myId: string;
  /** Slot being pointed at in the current draw: yours while you draw, the server's live one otherwise. */
  highlight: number | null;
  onHover: (slot: number | null) => void;
  onTap: (slot: number, mouse: boolean) => void;
  events: LoggedEvent[];
  emotes: LiveEmote[];
  quality: Quality;
  onQualityDrop: () => void;
  lobby: LobbyControls;
  /** What your 🔍 showed you: that card turns face up (on your screen only). */
  peekReveal: { targetId: string; slot: number; card: number } | null;
  /** The card someone looked at with 🔍 this turn, tagged for everyone. */
  peekMark: { targetId: string; slot: number } | null;
}

const CENTER = new THREE.Vector3(0, TABLE_TOP, 0);
const UP = new THREE.Vector3(0, 1, 0);
const FLIP = new THREE.Quaternion().setFromAxisAngle(UP, Math.PI);
/** A card tossed from a hand at rest, tilted back. */
const TOSSED = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.4 * Math.PI, 0, 0));
/** Camera-space spots: the drawn card in front of your eyes, and the bottom of the screen (your hand). */
const HOLD_SPOT = new THREE.Vector3(0, 0.1, -2.1);
const HAND_SPOT = new THREE.Vector3(0, -0.95, -1.7);
const STASH_SPOT = new THREE.Vector3(0, -1.4, -2.1);
const THROW_MS = 1050;
const TAN_HALF_FOV = Math.tan((50 / 2) * (Math.PI / 180));
/** The lobby / result panel docked on the right on a wide screen (23rem + margin). */
const SIDE_SHEET_PX = 380;

const REST_POS = Array.from({ length: MAX_SEATS }, (_, seat) => onCircle(seatAngle(seat), FAN_R, FAN_Y));
const EYES = Array.from({ length: MAX_SEATS }, (_, seat) => onCircle(seatAngle(seat), SEAT_R - 0.25, EYE_Y));
/**
 * Where a drawer holds the card they just drew: out in front, chin high and a little to one
 * side — every camera looks down on it, so the pig's face shows above it. Kept upright, back
 * to the table, so no camera ever sees its face.
 */
const HOLD_SPOTS = Array.from({ length: MAX_SEATS }, (_, seat) => onCircle(seatAngle(seat) + 0.16, 2.9, 1.6));

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Someone else's draw, seen from across the table: both pigs face the camera, the offered hand between them. */
function sideOnShot(drawerSeat: number, targetSeat: number, myAngle: number, aspect: number) {
  const a = EYES[drawerSeat];
  const b = EYES[targetSeat];
  const look = a.clone().add(b).multiplyScalar(0.5);
  look.y = 1.55;
  const outward = new THREE.Vector3(look.x, 0, look.z);
  if (outward.lengthSq() < 0.25) {
    // Sitting opposite each other: look along the table from your side instead.
    outward.set(b.z - a.z, 0, a.x - b.x);
    if (outward.dot(onCircle(myAngle, 1, 0)) < 0) outward.negate();
  }
  outward.normalize();
  const spread = Math.hypot(a.x - b.x, a.z - b.z) / 2 + 1;
  const distance = clamp(spread / (TAN_HALF_FOV * Math.min(aspect, 1.7)), 5.5, 11);
  // Low (about 24°), so the line of sight passes under the lantern over the middle of the table.
  const position = look.clone().addScaledVector(outward, -distance * 0.91);
  position.y += distance * 0.41;
  return { position, look };
}

/** Deterministic mess for the discard pile. */
function pileSpot(index: number) {
  const a = Math.sin(index * 12.9898) * 43758.5453;
  const b = Math.sin(index * 78.233) * 12345.6789;
  const r = 0.25 + (a - Math.floor(a)) * 0.75;
  const angle = (b - Math.floor(b)) * Math.PI * 2;
  return { x: Math.cos(angle) * r, z: Math.sin(angle) * r * 0.8 - 0.1, spin: (a - Math.floor(a)) * Math.PI * 2 };
}

interface Pose {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
}
type Origins = React.RefObject<Map<number, { from: THREE.Vector3; quat?: THREE.Quaternion; delay: number; duration: number }>>;

function DiscardCard({ card, index, origins }: { card: number; index: number; origins: Origins }) {
  const ref = useRef<THREE.Group>(null);
  const spot = useMemo(() => pileSpot(index), [index]);
  const target = useMemo(() => new THREE.Vector3(spot.x, TABLE_TOP + 0.075 + index * 0.0015, spot.z), [spot, index]);
  const flat = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, spot.spin)), [spot]);
  const flight = useRef<{ from: THREE.Vector3; quat: THREE.Quaternion; at: number; duration: number } | null | undefined>(undefined);

  useFrame(() => {
    const group = ref.current;
    if (!group) return;
    if (flight.current === undefined) {
      // First frame: if this card was just thrown, fly it in from whoever threw it.
      const origin = origins.current.get(card);
      origins.current.delete(card);
      flight.current = origin ? { from: origin.from.clone(), quat: (origin.quat ?? TOSSED).clone(), at: performance.now() + origin.delay, duration: origin.duration } : null;
    }
    const current = flight.current;
    if (!current) {
      group.position.copy(target);
      group.quaternion.copy(flat);
      group.visible = true;
      return;
    }
    const now = performance.now();
    const t = Math.min(1, Math.max(0, (now - current.at) / current.duration));
    // Off the hand quickly, then floating down to the felt, turning face up.
    const ease = 1 - Math.pow(1 - t, 2.6);
    group.position.lerpVectors(current.from, target, ease);
    group.position.y += Math.sin(t * Math.PI) * (0.35 + current.from.distanceTo(target) * 0.18);
    group.quaternion.slerpQuaternions(current.quat, flat, Math.min(1, t * 1.2));
    group.rotateOnWorldAxis(UP, (1 - ease) * 1.6);
    group.visible = now >= current.at;
    if (t >= 1) flight.current = null;
  });

  return (
    <group ref={ref} visible={false}>
      <mesh geometry={cardGeometry} material={getBackMaterial()} position={[0, 0, 0.001]} receiveShadow />
      <mesh geometry={cardGeometry} material={faceMaterial(card)} position={[0, 0, -0.001]} rotation={[0, Math.PI, 0]} receiveShadow />
    </group>
  );
}

interface Held {
  key: number;
  drawerId: string;
  /** Your own draw: it hangs in front of your eyes and turns face up. */
  mine: boolean;
  card?: number;
  /** Where it was drawn from (null: just appear, e.g. after a reconnect). */
  from: THREE.Vector3 | null;
  /** Kept, not paired: sliding down into your hand. */
  stashAt?: number;
  /** Thrown down or put away (kept as a marker so a stale state can't bring it back). */
  done?: boolean;
}

const finish = (held: Held | null): Held | null => held && { ...held, done: true };

/** The card just drawn, in the drawer's fingers while they check it against their hand. */
function HeldCard({ held, holdAt, pose, onStashed }: { held: Held; holdAt: THREE.Vector3; pose: React.RefObject<Pose>; onStashed: () => void }) {
  const ref = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const startedAt = useRef(performance.now());
  const done = useRef(false);
  // Someone else holds it up in front of their face: back to the table, face to themselves.
  const holdQuat = useMemo(() => {
    const dummy = new THREE.Object3D();
    dummy.position.copy(holdAt);
    dummy.lookAt(0, holdAt.y, 0);
    return dummy.quaternion.clone();
  }, [holdAt]);
  const spot = useMemo(() => new THREE.Vector3(), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);
  const turn = useMemo(() => new THREE.Quaternion(), []);
  const wobble = useMemo(() => new THREE.Quaternion(), []);
  const euler = useMemo(() => new THREE.Euler(), []);

  useFrame(({ clock }) => {
    const group = ref.current;
    if (!group) return;
    const now = performance.now();
    const t = held.from ? Math.min(1, (now - startedAt.current) / 550) : 1;
    const ease = 1 - Math.pow(1 - t, 3);
    const time = clock.elapsedTime;
    if (held.mine) {
      spot.copy(HOLD_SPOT).applyMatrix4(camera.matrixWorld);
      // Turns its face to you as it arrives.
      quat.copy(camera.quaternion).multiply(turn.setFromAxisAngle(UP, Math.PI * Math.min(1, t * 1.4)));
    } else {
      spot.copy(holdAt);
      quat.copy(holdQuat);
    }
    // Looked over: a little tilt this way and that.
    quat.multiply(wobble.setFromEuler(euler.set(Math.sin(time * 2.3) * 0.07, Math.sin(time * 1.7) * 0.1, Math.sin(time * 3.1) * 0.06)));
    spot.y += Math.sin(time * 2.6) * 0.025;

    if (held.stashAt) {
      const s = Math.min(1, (now - held.stashAt) / 380);
      group.position.lerpVectors(spot, STASH_SPOT.clone().applyMatrix4(camera.matrixWorld), s * s);
      group.scale.setScalar(1 - s * 0.4);
      if (s >= 1 && !done.current) {
        done.current = true;
        onStashed();
      }
    } else if (held.from) {
      group.position.lerpVectors(held.from, spot, ease);
      group.position.y += Math.sin(t * Math.PI) * 0.3;
    } else {
      group.position.copy(spot);
    }
    group.quaternion.copy(quat);
    pose.current.pos.copy(group.position);
    pose.current.quat.copy(group.quaternion);
  });

  return (
    <group ref={ref} renderOrder={5}>
      <mesh geometry={cardGeometry} material={getBackMaterial()} position={[0, 0, 0.001]} />
      <mesh geometry={cardGeometry} material={held.mine && held.card !== undefined ? faceMaterial(held.card) : getBackMaterial()} position={[0, 0, -0.001]} rotation={[0, Math.PI, 0]} />
    </group>
  );
}

/**
 * Eases the camera to where the scene wants it, going round the table's axis
 * (so a change of seat is a swing round the table, not a cut). `shift` slides
 * the picture left by that many pixels, clear of a panel docked on the right.
 */
function CameraRig({ position, look, shift }: { position: THREE.Vector3; look: THREE.Vector3; shift: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const rig = useRef<{ angle: number; radius: number; y: number; look: THREE.Vector3; shift: number } | null>(null);
  useFrame((_, delta) => {
    const k = 1 - Math.exp(-delta * 3.2);
    rig.current ??= {
      angle: Math.atan2(camera.position.x, camera.position.z),
      radius: Math.hypot(camera.position.x, camera.position.z),
      y: camera.position.y,
      look: look.clone(),
      shift: 0,
    };
    const current = rig.current;
    const angle = Math.atan2(position.x, position.z);
    current.angle += Math.atan2(Math.sin(angle - current.angle), Math.cos(angle - current.angle)) * k;
    current.radius += (Math.hypot(position.x, position.z) - current.radius) * k;
    current.y += (position.y - current.y) * k;
    current.look.lerp(look, k);
    camera.position.set(Math.sin(current.angle) * current.radius, current.y, Math.cos(current.angle) * current.radius);
    camera.lookAt(current.look);
    current.shift += (shift - current.shift) * k;
    if (Math.abs(current.shift) > 0.5) camera.setViewOffset(size.width, size.height, current.shift, 0, size.width, size.height);
    else if (camera.view?.enabled) camera.clearViewOffset();
  });
  return null;
}

function Room({ quality }: { quality: Quality }) {
  return (
    <>
      <color attach="background" args={["#170e09"]} />
      <fog attach="fog" args={["#170e09", 10, 24]} />
      <ambientLight intensity={0.7} color="#ffe2c4" />
      <hemisphereLight intensity={0.55} color="#ffd9a8" groundColor="#2a1a10" />
      <directionalLight
        position={[3, 9, 4]}
        intensity={1.4}
        color="#fff1dc"
        castShadow={quality === "high"}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
      />
      <pointLight position={[0, 4.1, 0]} intensity={14} distance={0} decay={2} color="#ffb86b" />
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[16, 48]} />
        <meshStandardMaterial color="#3a2415" roughness={0.95} />
      </mesh>
      {/* table: felt, wooden rim, pedestal */}
      <mesh position={[0, TABLE_TOP - 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[TABLE_R, TABLE_R, 0.12, 64]} />
        <meshStandardMaterial color="#1c6b44" roughness={0.95} />
      </mesh>
      <mesh position={[0, TABLE_TOP, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <torusGeometry args={[TABLE_R, 0.11, 14, 72]} />
        <meshStandardMaterial color="#6b3f1d" roughness={0.6} />
      </mesh>
      <mesh position={[0, TABLE_TOP / 2 - 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.45, 0.8, TABLE_TOP - 0.1, 24]} />
        <meshStandardMaterial color="#4a2a12" roughness={0.8} />
      </mesh>
      {/* lantern over the table */}
      <group position={[0, 4.3, 0]}>
        <mesh>
          <cylinderGeometry args={[0.3, 0.3, 0.55, 16, 1, true]} />
          <meshStandardMaterial color="#ff9b45" emissive="#ff7a1a" emissiveIntensity={1.6} side={THREE.DoubleSide} transparent opacity={0.92} />
        </mesh>
        <mesh position={[0, 0.32, 0]}>
          <cylinderGeometry args={[0.18, 0.34, 0.1, 16]} />
          <meshStandardMaterial color="#3b1d0b" />
        </mesh>
        <mesh position={[0, 1.2, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 1.8, 6]} />
          <meshStandardMaterial color="#1a0f08" />
        </mesh>
      </group>
      {/* far lanterns for depth */}
      {Array.from({ length: 8 }, (_, index) => {
        const angle = (index / 8) * Math.PI * 2;
        return (
          <mesh key={index} position={[Math.cos(angle) * 11, 3.4 + (index % 2) * 0.6, Math.sin(angle) * 11]}>
            <sphereGeometry args={[0.22, 12, 10]} />
            <meshBasicMaterial color={index % 2 ? "#ffb35c" : "#ff6b6b"} toneMapped={false} />
          </mesh>
        );
      })}
    </>
  );
}

function SceneContents(props: Table3DProps) {
  const { state, myId, events, emotes, quality, lobby } = props;
  const size = useThree((s) => s.size);
  const aspect = size.width / Math.max(1, size.height);
  const portrait = aspect < 0.8;
  const camera = useThree((s) => s.camera);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  const me = state.players.find((player) => player.id === myId);
  // Watching from no seat: from the front, a little higher (over whoever sits there).
  const myAngle = seatAngle(me?.seat ?? 0);
  const watching = me?.seat == null;
  const seated = useMemo(() => state.players.filter((player) => player.seat !== null), [state.players]);
  const bySeat = useMemo(() => new Map(seated.map((player) => [player.seat!, player])), [seated]);
  const seatOf = useCallback((id: string | undefined) => state.players.find((player) => player.id === id)?.seat ?? null, [state.players]);
  const restPos = REST_POS;
  const eyes = EYES;
  const overviewPos = useMemo(() => onCircle(myAngle, portrait ? 8.6 : 6.6, (portrait ? 8.2 : 5.4) + (watching ? 1.6 : 0)), [myAngle, portrait, watching]);

  const turn = state.turn;
  const pending = state.pending;
  const iDraw = turn?.drawerId === myId;
  const drawerSeat = seatOf(turn?.drawerId);
  const targetSeat = seatOf(turn?.targetId);
  // The draw on camera: from pointing at a card through checking the one taken, and held
  // through the short gap before the next turn so the camera doesn't bounce back and forth.
  const actionDrawerSeat = seatOf(turn?.drawerId ?? pending?.drawerId);
  const actionTargetSeat = seatOf(turn?.targetId ?? pending?.targetId);
  const lastAction = useRef<{ drawer: number; target: number } | null>(null);
  if (state.phase !== "playing") lastAction.current = null;
  else if (actionDrawerSeat !== null && actionTargetSeat !== null) lastAction.current = { drawer: actionDrawerSeat, target: actionTargetSeat };
  const framedDrawer = lastAction.current?.drawer ?? null;
  const framedTarget = lastAction.current?.target ?? null;
  const involved = me?.seat != null && (framedDrawer === me.seat || framedTarget === me.seat);
  const sideOn = useMemo(
    () => (framedDrawer !== null && framedTarget !== null && !involved ? sideOnShot(framedDrawer, framedTarget, myAngle, aspect) : null),
    [framedDrawer, framedTarget, involved, myAngle, aspect],
  );

  // The hand being drawn from is held out to the drawer: right before your eyes if it's you
  // drawing, across the felt (turned a little towards the camera) for anyone else's draw. Your
  // own hand never is — when you're drawn from, your face-up hand at the bottom shows it all.
  const offer = useMemo<FanOffer | null>(() => {
    if (drawerSeat === null || targetSeat === null || turn?.targetId === myId) return null;
    const to = eyes[drawerSeat];
    return { to, pov: iDraw, face: iDraw ? to : to.clone().lerp(sideOn?.position ?? overviewPos, 0.5) };
  }, [drawerSeat, targetSeat, turn?.targetId, myId, eyes, iDraw, sideOn, overviewPos]);

  // ---------- dealing: cards appear in each hand one by one ----------
  const dealCounts = useRef<Record<string, number>>({});
  const dealing = state.phase === "dealing" && state.phaseEndsAt !== null && now < state.phaseEndsAt - OPENING_PAIRS_MS;
  const dealStart = state.phaseEndsAt ? state.phaseEndsAt - OPENING_PAIRS_MS - DEAL_MS : 0;
  const dealProgress = dealing ? Math.min(1, Math.max(0, (now - dealStart) / DEAL_MS)) : 1;
  const dealingRef = useRef(dealing);
  dealingRef.current = dealing;

  // ---------- events → flights ----------
  const fans = useRef(new Map<string, THREE.Group>());
  const registers = useRef(new Map<string, (group: THREE.Group | null) => void>());
  const registerFor = useCallback((id: string) => {
    let fn = registers.current.get(id);
    if (!fn) {
      fn = (group) => {
        if (group) fans.current.set(id, group);
        else fans.current.delete(id);
      };
      registers.current.set(id, fn);
    }
    return fn;
  }, []);
  const origins = useRef(new Map<number, { from: THREE.Vector3; quat?: THREE.Quaternion; delay: number; duration: number }>());
  const incoming = useRef(new Map<string, { from: THREE.Vector3; until: number }>());
  const heldPose = useRef<Pose>({ pos: new THREE.Vector3(), quat: new THREE.Quaternion() });
  const [held, setHeld] = useState<Held | null>(null);
  const lastSeq = useRef(0);

  // Layout effect: runs before the next frame, so cards mounted by the same update find their origins.
  useLayoutEffect(() => {
    const onScreen = (spot: THREE.Vector3) => spot.clone().applyMatrix4(camera.matrixWorld);
    for (const { seq, event } of events) {
      if (seq <= lastSeq.current) continue;
      lastSeq.current = seq;
      if (event.type === "deal") {
        dealCounts.current = event.counts;
        origins.current.clear();
        incoming.current.clear();
        setHeld(null);
      }
      if (event.type === "pairs") {
        let order = 0;
        for (const [playerId, cards] of Object.entries(event.byPlayer)) {
          const seat = seatOf(playerId);
          const from = playerId === myId ? onScreen(HAND_SPOT) : seat !== null ? restPos[seat].clone() : CENTER.clone();
          cards.forEach((card) => origins.current.set(card, { from, delay: order++ * 70, duration: 750 }));
        }
      }
      if (event.type === "drew") {
        const seat = seatOf(event.targetId);
        const slots = fans.current.get(event.targetId)?.userData.slots as THREE.Vector3[] | undefined;
        const from =
          event.targetId === myId ? onScreen(HAND_SPOT) : slots?.[event.slot]?.clone() ?? (seat !== null ? restPos[seat].clone() : CENTER.clone());
        heldPose.current.pos.copy(from);
        setHeld({ key: seq, drawerId: event.drawerId, mine: event.drawerId === myId, card: event.card, from });
      }
      if (event.type === "skill") {
        // The played card lands face up in the middle once its "tung chiêu" moment is over.
        const seat = seatOf(event.playerId);
        const from = event.playerId === myId ? onScreen(HAND_SPOT) : seat !== null ? restPos[seat].clone() : CENTER.clone();
        origins.current.set(event.card, { from, delay: SKILL_SHOW_MS - 600, duration: THROW_MS });
      }
      if (event.type === "kept") {
        // 🤲: the card not kept goes back into the hand it came from.
        incoming.current.set(event.targetId, { from: heldPose.current.pos.clone(), until: Date.now() + 900 });
        if (event.drawerId === myId && event.kept !== undefined) setHeld((current) => (current ? { ...current, card: event.kept } : current));
      }
      if (event.type === "resolved" && event.returned) {
        // 🛡️: the drawn card flies straight back.
        incoming.current.set(event.targetId, { from: heldPose.current.pos.clone(), until: Date.now() + 900 });
        setHeld(finish);
        continue;
      }
      if (event.type === "resolved") {
        const mine = event.drawerId === myId;
        const seat = seatOf(event.drawerId);
        const { pos, quat } = heldPose.current;
        if (event.pair) {
          // Thrown down together: the drawn card from the fingers, its mate from the hand.
          origins.current.set(event.pair[1], { from: pos.clone(), quat: quat.clone(), delay: 0, duration: THROW_MS });
          origins.current.set(event.pair[0], {
            from: mine ? onScreen(HAND_SPOT) : seat !== null ? restPos[seat].clone() : CENTER.clone(),
            quat: mine ? camera.quaternion.clone().multiply(FLIP) : undefined,
            delay: 140,
            duration: THROW_MS,
          });
          setHeld(finish);
        } else if (mine) {
          setHeld((current) => (current?.mine ? { ...current, stashAt: performance.now() } : finish(current)));
        } else {
          incoming.current.set(event.drawerId, { from: pos.clone(), until: Date.now() + 900 });
          setHeld(finish);
        }
      }
    }
  }, [events, seatOf, myId, restPos, camera]);

  const getIncoming = useCallback(
    (playerId: string) => () => {
      if (dealingRef.current) return CENTER;
      const arriving = incoming.current.get(playerId);
      return arriving && arriving.until > Date.now() ? arriving.from : null;
    },
    [],
  );

  // The card in the drawer's fingers: from the draw event, or (joined mid-draw) just from the state.
  const heldView: Held | null = held
    ? !held.done && (held.stashAt || pending?.drawerId === held.drawerId)
      ? held
      : null
    : pending
      ? { key: -pending.since, drawerId: pending.drawerId, mine: pending.drawerId === myId, from: null }
      : null;
  const heldSeat = heldView ? seatOf(heldView.drawerId) : null;
  const angleOf = seatAngle;
  const clearHeld = useCallback(() => setHeld(finish), []);

  // ---------- camera ----------
  const pigSeat = state.phase === "roundEnd" || state.phase === "final" ? seatOf(state.lastRound?.pigId) : null;
  // Your draw, and the check of the card you took: first person, looking where that hand was held out.
  const myDrawFromSeat = iDraw ? targetSeat : pending?.drawerId === myId ? seatOf(pending.targetId) : null;
  const myDrawFromCount = myDrawFromSeat !== null ? (bySeat.get(myDrawFromSeat)?.cardCount ?? 0) + (iDraw ? 0 : 1) : 0;
  // A panel docks on the right of a wide screen in the lobby and between rounds: keep the table clear of it.
  const sideSheet = !portrait && size.width >= 640 && (state.phase === "lobby" || state.phase === "roundEnd" || state.phase === "final");
  const view = useMemo(() => {
    if (me?.seat != null && myDrawFromSeat !== null) {
      const eye = eyes[me.seat];
      const pose = fanPose(restPos[myDrawFromSeat], { to: eye, pov: true, face: eye }, Math.max(1, myDrawFromCount), aspect);
      const position = eye.clone().addScaledVector(pose.position.clone().sub(eye).normalize(), -0.15);
      position.y += 0.05;
      return { position, look: pose.position };
    }
    if (pigSeat !== null) {
      const angle = seatAngle(pigSeat);
      const look = onCircle(angle, SEAT_R, portrait ? 1.05 : 1.85);
      return { position: onCircle(angle, SEAT_R - 2.3, 2.7), look };
    }
    if (sideOn) return sideOn;
    if (state.phase === "lobby" && !portrait) {
      // Pull back until every seat (and its "＋ Ngồi đây") fits beside the panel.
      const freeAspect = (size.width - (sideSheet ? SIDE_SHEET_PX : 0)) / Math.max(1, size.height);
      const distance = clamp(5.4 / (TAN_HALF_FOV * freeAspect), 8, 16);
      const look = onCircle(myAngle, 0.3, 0.6);
      return { position: look.clone().add(onCircle(myAngle, distance * 0.74, distance * 0.67)), look };
    }
    // On a phone the lobby / result panel covers the lower half: aim lower so the table sits up top.
    const sheetUp = portrait && state.phase !== "dealing" && state.phase !== "playing";
    const look = onCircle(myAngle, portrait ? (sheetUp ? 1.2 : -0.2) : -0.5, sheetUp ? -1.9 : 0.9);
    // Your hand being drawn from (or just drawn from): lean towards the drawer.
    if (involved && framedDrawer !== null && framedDrawer !== me?.seat) look.lerp(onCircle(seatAngle(framedDrawer), SEAT_R - 0.6, 1.5), 0.35);
    else if (involved && framedTarget !== null && framedTarget !== me?.seat) look.lerp(onCircle(seatAngle(framedTarget), SEAT_R - 0.6, 1.5), 0.3);
    return { position: overviewPos, look };
  }, [me?.seat, myDrawFromSeat, myDrawFromCount, eyes, restPos, aspect, portrait, pigSeat, sideOn, state.phase, size.width, size.height, sideSheet, myAngle, involved, framedDrawer, framedTarget, overviewPos]);

  // In the lobby: who you'd draw from (on your right) and who draws from you (on your left).
  const seatedSeats = seated.map((player) => player.seat!);
  const drawFromSeat = me?.seat != null && seated.length > 1 ? seatBefore(seatedSeats, me.seat) : undefined;
  const drawnBySeat = me?.seat != null && seated.length > 1 ? seatAfter(seatedSeats, me.seat) : undefined;

  // ---------- render ----------
  const latestEmote = (playerId: string): { emote: Emote; at: number } | null => {
    for (let index = emotes.length - 1; index >= 0; index--) if (emotes[index].playerId === playerId) return emotes[index];
    return null;
  };
  const roundPigId = state.phase === "roundEnd" || state.phase === "final" ? state.lastRound?.pigId ?? null : null;
  const inLobby = state.phase === "lobby";

  return (
    <>
      <Room quality={quality} />
      <CameraRig position={view.position} look={view.look} shift={sideSheet ? SIDE_SHEET_PX / 2 : 0} />

      {/* the deck in the middle while it's being dealt */}
      {dealing && dealProgress < 1 && (
        <mesh position={[0, TABLE_TOP + 0.06 + (1 - dealProgress) * 0.12, 0]} castShadow>
          <boxGeometry args={[0.62, (1 - dealProgress) * 0.24 + 0.01, CARD_H]} />
          <meshStandardMaterial color="#7a0f22" roughness={0.6} />
        </mesh>
      )}

      {/* thrown pairs, face up */}
      {state.discard.map((card, index) => (
        <DiscardCard key={`${state.round}-${card}`} card={card} index={index} origins={origins} />
      ))}

      {/* seats */}
      {Array.from({ length: MAX_SEATS }, (_, seat) => {
        const player = bySeat.get(seat);
        const angle = angleOf(seat);
        if (!player) {
          const canSit = inLobby && lobby.mySeat !== seat;
          return (
            <group key={`empty-${seat}`}>
              <mesh position={onCircle(angle, SEAT_R, 0.35)} castShadow receiveShadow>
                <cylinderGeometry args={[0.45, 0.5, 0.7, 20]} />
                <meshStandardMaterial color="#4a2a12" roughness={0.85} />
              </mesh>
              {canSit && (
                <Label position={onCircle(angle, SEAT_R, 1.35)} zIndexRange={[25, 0]}>
                  <div className="flex flex-col items-center gap-1.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => lobby.onSit(seat)}
                      className="rounded-full border-2 border-dashed border-amber-200/70 bg-black/55 px-3 py-1.5 text-xs font-bold text-amber-100 backdrop-blur transition hover:scale-105 hover:bg-amber-300 hover:text-amber-950"
                    >
                      ＋ Ngồi đây
                    </button>
                    {lobby.isHost && (
                      <button
                        type="button"
                        onClick={() => lobby.onAddBot(seat)}
                        className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white/85 backdrop-blur transition hover:bg-white/30"
                      >
                        🤖 Thêm bot
                      </button>
                    )}
                  </div>
                </Label>
              )}
            </group>
          );
        }
        // Your own cards are the face-up hand at the bottom of the screen, never a 3D fan.
        if (player.id === myId) return null;
        const status: AvatarStatus = {
          name: player.name,
          cardCount: player.cardCount,
          isHost: state.hostId === player.id,
          isBot: player.isBot,
          standIn: player.standIn,
          connected: player.connected,
          disconnectedUntil: player.disconnectedUntil,
          place: player.finishedRank,
          crowned: state.pigId === player.id,
          shamed: roundPigId === player.id,
          drawing: turn?.drawerId === player.id || pending?.drawerId === player.id,
          beingDrawn: turn?.targetId === player.id,
          ready: player.ready,
          showReady: inLobby && !player.isBot,
          turnEndsAt: turn?.drawerId === player.id ? turn.endsAt : null,
        };
        const isTarget = turn?.targetId === player.id;
        const neighbour =
          seat === drawFromSeat && seat === drawnBySeat
            ? "🔁 Hai bạn rút bài của nhau"
            : seat === drawFromSeat
              ? "🎯 Bạn rút bài người này"
              : seat === drawnBySeat
                ? "👀 Người này rút bài bạn"
                : null;
        const removable = lobby.isHost && player.isBot;
        const dealt = dealCounts.current[player.id] ?? player.cardCount;
        const count = dealing ? Math.min(dealt, Math.ceil(dealt * dealProgress)) : player.cardCount;
        return (
          <group key={player.id}>
            <PigAvatar
              seat={seat}
              angle={angle}
              status={status}
              emote={latestEmote(player.id)}
              lobby={
                inLobby && (neighbour || removable) ? (
                  <Label position={[0, 3.5, 0]} zIndexRange={[25, 0]}>
                    <div className="flex flex-col items-center gap-1 whitespace-nowrap">
                      {neighbour && <span className="rounded-full bg-amber-300/95 px-2.5 py-0.5 text-[11px] font-black text-amber-950 shadow">{neighbour}</span>}
                      {removable && (
                        <button
                          type="button"
                          onClick={() => lobby.onRemoveBot(player.id)}
                          className="rounded-full bg-red-500/90 px-2.5 py-1 text-[11px] font-bold text-white shadow transition hover:bg-red-500"
                        >
                          ✕ Mời bot ra
                        </button>
                      )}
                    </div>
                  </Label>
                ) : null
              }
            />
            {count > 0 && (
              <Fan
                count={count}
                restPos={restPos[seat]}
                offer={isTarget ? offer : null}
                aspect={aspect}
                highlight={isTarget ? props.highlight : null}
                teased={state.teased[player.id] ?? null}
                scanning={pending?.drawerId === player.id}
                interactive={isTarget && iDraw}
                onHover={props.onHover}
                onTap={props.onTap}
                revealCards={roundPigId ? state.lastRound?.leftovers?.[player.id] ?? null : null}
                revealSlot={isTarget && iDraw && props.peekReveal?.targetId === player.id ? props.peekReveal : null}
                markSlot={isTarget && props.peekMark?.targetId === player.id ? props.peekMark.slot : null}
                getIncoming={getIncoming(player.id)}
                register={registerFor(player.id)}
              />
            )}
          </group>
        );
      })}

      {/* the card just drawn, being checked */}
      {heldView && heldSeat !== null && <HeldCard key={heldView.key} held={heldView} holdAt={HOLD_SPOTS[heldSeat]} pose={heldPose} onStashed={clearHeld} />}

      {/* your own seat: a ring on the felt, and a label while choosing seats */}
      {me?.seat != null && (
        <>
          <mesh position={onCircle(myAngle, SEAT_R - 0.9, TABLE_TOP + 0.005)} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.32, 0.4, 32]} />
            <meshBasicMaterial color={SEAT_COLORS[me.seat % SEAT_COLORS.length]} transparent opacity={0.6} />
          </mesh>
          {inLobby && (
            <Label position={onCircle(myAngle, SEAT_R - 0.9, TABLE_TOP + 0.4)} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
              <span className="whitespace-nowrap rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-amber-950 shadow-lg">🫵 Bạn ngồi đây</span>
            </Label>
          )}
        </>
      )}
    </>
  );
}

export default function Table3D(props: Table3DProps) {
  return (
    <Canvas
      shadows={props.quality === "high"}
      dpr={props.quality === "high" ? [1, 2] : 1}
      camera={{ fov: 50, near: 0.1, far: 60, position: [0, 5.4, 6.6] }}
      gl={{ antialias: props.quality === "high", powerPreference: "high-performance" }}
      className="!absolute inset-0"
    >
      <PerformanceMonitor onDecline={props.onQualityDrop} />
      <SceneContents {...props} />
    </Canvas>
  );
}
