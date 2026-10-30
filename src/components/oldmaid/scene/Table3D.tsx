"use client";

import { Html, PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { DEAL_MS, MAX_SEATS, OPENING_PAIRS_MS, type Emote, type PublicOldMaidState } from "@shared/oldMaidTypes";
import type { LiveEmote, LoggedEvent } from "@/lib/useOldMaidRoom";
import { CARD_H, EYE_Y, FAN_R, FAN_Y, SEAT_R, TABLE_R, TABLE_TOP, cardGeometry, faceMaterial, fanLayout, getBackMaterial, onCircle, seatAngle } from "./cards3d";
import { Fan, fanPose } from "./Fan";
import { PigAvatar, SEAT_COLORS, type AvatarStatus } from "./PigAvatar";

// The 3D table. Camera: from your seat when nothing is happening, then for
// every draw it flies to the drawer's eyes (first person) looking at the hand
// held out to them — you watch their pointer wander over the cards live.

export type CameraMode = "follow" | "overview";
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
  myHandCount: number;
  /** Slot being pointed at in the current draw: yours while you draw, the server's live one otherwise. */
  highlight: number | null;
  onHover: (slot: number | null) => void;
  onTap: (slot: number, mouse: boolean) => void;
  events: LoggedEvent[];
  emotes: LiveEmote[];
  quality: Quality;
  cameraMode: CameraMode;
  onQualityDrop: () => void;
  lobby: LobbyControls;
}

const CENTER = new THREE.Vector3(0, TABLE_TOP, 0);
const UP = new THREE.Vector3(0, 1, 0);

/** Deterministic mess for the discard pile. */
function pileSpot(index: number) {
  const a = Math.sin(index * 12.9898) * 43758.5453;
  const b = Math.sin(index * 78.233) * 12345.6789;
  const r = 0.25 + (a - Math.floor(a)) * 0.75;
  const angle = (b - Math.floor(b)) * Math.PI * 2;
  return { x: Math.cos(angle) * r, z: Math.sin(angle) * r * 0.8 - 0.1, spin: (a - Math.floor(a)) * Math.PI * 2 };
}

type Origins = React.RefObject<Map<number, { from: THREE.Vector3; delay: number }>>;

function DiscardCard({ card, index, origins }: { card: number; index: number; origins: Origins }) {
  const ref = useRef<THREE.Group>(null);
  const spot = useMemo(() => pileSpot(index), [index]);
  const target = useMemo(() => new THREE.Vector3(spot.x, TABLE_TOP + 0.075 + index * 0.0015, spot.z), [spot, index]);
  const start = useRef<{ from: THREE.Vector3; at: number } | null | undefined>(undefined);

  useFrame(() => {
    const group = ref.current;
    if (!group) return;
    if (start.current === undefined) {
      // First frame: if this card was just thrown, fly it in from whoever threw it.
      const origin = origins.current.get(card);
      origins.current.delete(card);
      start.current = origin ? { from: origin.from.clone(), at: performance.now() + origin.delay } : null;
    }
    const flight = start.current;
    if (!flight) {
      group.position.copy(target);
      group.rotation.set(Math.PI / 2, 0, spot.spin);
      group.visible = true;
      return;
    }
    const t = Math.min(1, Math.max(0, (performance.now() - flight.at) / 650));
    const ease = 1 - Math.pow(1 - t, 3);
    group.position.lerpVectors(flight.from, target, ease);
    group.position.y += Math.sin(t * Math.PI) * 0.9;
    // Flips face up on the way down.
    group.rotation.set(Math.PI / 2 - (1 - ease) * Math.PI * 0.9, 0, spot.spin * ease);
    group.visible = performance.now() >= flight.at;
    if (t >= 1) start.current = null;
  });

  return (
    <group ref={ref} visible={false}>
      <mesh geometry={cardGeometry} material={getBackMaterial()} position={[0, 0, 0.001]} receiveShadow />
      <mesh geometry={cardGeometry} material={faceMaterial(card)} position={[0, 0, -0.001]} rotation={[0, Math.PI, 0]} receiveShadow />
    </group>
  );
}

/** A card flying from the hand you drew from down towards your own hand (at the bottom of the screen). */
function Flyer({ from, card, onDone }: { from: THREE.Vector3; card: number | undefined; onDone: () => void }) {
  const ref = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const startAt = useRef(performance.now());
  const to = useMemo(() => new THREE.Vector3(0, -0.75, -1.2).applyMatrix4(camera.matrixWorld), [camera]);
  useFrame(() => {
    const group = ref.current;
    if (!group) return;
    const t = Math.min(1, (performance.now() - startAt.current) / 700);
    const ease = 1 - Math.pow(1 - t, 3);
    group.position.lerpVectors(from, to, ease);
    group.position.y += Math.sin(t * Math.PI) * 0.25;
    group.lookAt(camera.position);
    // Turns its face to you as it comes.
    group.rotateY(Math.PI * Math.min(1, t * 1.6));
    group.scale.setScalar(1 - t * 0.35);
    if (t >= 1) onDone();
  });
  return (
    <group ref={ref}>
      <mesh geometry={cardGeometry} material={getBackMaterial()} position={[0, 0, 0.001]} />
      <mesh geometry={cardGeometry} material={card !== undefined ? faceMaterial(card) : getBackMaterial()} position={[0, 0, -0.001]} rotation={[0, Math.PI, 0]} />
    </group>
  );
}

function CameraRig({ position, look }: { position: THREE.Vector3; look: THREE.Vector3 }) {
  const current = useRef(look.clone());
  const camera = useThree((s) => s.camera);
  useFrame((_, delta) => {
    const k = 1 - Math.exp(-delta * 3.2);
    camera.position.lerp(position, k);
    current.current.lerp(look, k);
    camera.lookAt(current.current);
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
  const { state, myId, events, emotes, quality, cameraMode, lobby } = props;
  const size = useThree((s) => s.size);
  const aspect = size.width / Math.max(1, size.height);
  const camera = useThree((s) => s.camera);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  const me = state.players.find((player) => player.id === myId);
  const mySeat = me?.seat ?? 0;
  const seated = useMemo(() => state.players.filter((player) => player.seat !== null), [state.players]);
  const bySeat = useMemo(() => new Map(seated.map((player) => [player.seat!, player])), [seated]);
  const angleOf = useCallback((seat: number) => seatAngle(seat, mySeat), [mySeat]);
  const restPos = useMemo(() => Array.from({ length: MAX_SEATS }, (_, seat) => onCircle(seatAngle(seat, mySeat), FAN_R, FAN_Y)), [mySeat]);
  const eyes = useMemo(() => Array.from({ length: MAX_SEATS }, (_, seat) => onCircle(seatAngle(seat, mySeat), SEAT_R - 0.25, EYE_Y)), [mySeat]);

  const turn = state.turn;
  const drawer = turn ? state.players.find((player) => player.id === turn.drawerId) : undefined;
  const target = turn ? state.players.find((player) => player.id === turn.targetId) : undefined;
  const iDraw = turn?.drawerId === myId;
  // First person for every draw (yours always; others' unless the overview camera is chosen).
  const povSeat = drawer?.seat != null && (iDraw || cameraMode === "follow") ? drawer.seat : null;
  const offeredTo = povSeat !== null && target?.seat != null ? eyes[povSeat] : null;

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
  const origins = useRef(new Map<number, { from: THREE.Vector3; delay: number }>());
  const incoming = useRef(new Map<string, { from: THREE.Vector3; until: number }>());
  const [flyers, setFlyers] = useState<{ key: number; from: THREE.Vector3; card: number | undefined }[]>([]);
  const lastSeq = useRef(0);

  const slotWorld = useCallback(
    (ownerId: string, slot: number, count: number, offered: boolean) => {
      const group = fans.current.get(ownerId);
      if (!group) return null;
      const layout = fanLayout(count, offered, aspect)[slot];
      if (!layout) return null;
      group.updateWorldMatrix(true, false);
      return group.localToWorld(new THREE.Vector3(layout.x, layout.y, layout.z));
    },
    [aspect],
  );

  useEffect(() => {
    for (const { seq, event } of events) {
      if (seq <= lastSeq.current) continue;
      lastSeq.current = seq;
      if (event.type === "deal") {
        dealCounts.current = event.counts;
        origins.current.clear();
        incoming.current.clear();
      }
      if (event.type === "pairs") {
        let order = 0;
        for (const [playerId, cards] of Object.entries(event.byPlayer)) {
          const seat = state.players.find((player) => player.id === playerId)?.seat;
          const from = seat != null ? (playerId === myId ? camera.position.clone().addScaledVector(UP, -1.2) : restPos[seat].clone()) : CENTER.clone();
          cards.forEach((card) => origins.current.set(card, { from, delay: order++ * 70 }));
        }
      }
      if (event.type === "drew") {
        const drawerSeat = state.players.find((player) => player.id === event.drawerId)?.seat;
        const targetCount = state.players.find((player) => player.id === event.targetId)?.cardCount ?? 0;
        const from =
          slotWorld(event.targetId, event.slot, Math.max(targetCount, event.slot + 1), cameraMode === "follow" || event.drawerId === myId) ??
          (drawerSeat != null ? eyes[drawerSeat].clone() : CENTER.clone());
        if (event.pair) {
          const mateFrom = event.drawerId === myId ? camera.position.clone().addScaledVector(UP, -1.2) : drawerSeat != null ? restPos[drawerSeat].clone() : CENTER.clone();
          origins.current.set(event.pair[0], { from: mateFrom, delay: 120 });
          origins.current.set(event.pair[1], { from, delay: 0 });
        } else if (event.drawerId === myId) {
          setFlyers((current) => [...current, { key: seq, from, card: event.card }]);
        } else {
          incoming.current.set(event.drawerId, { from, until: Date.now() + 900 });
        }
      }
    }
  }, [events, state.players, myId, restPos, eyes, camera, slotWorld, cameraMode]);

  const getIncoming = useCallback(
    (playerId: string) => () => {
      if (dealingRef.current) return CENTER;
      const arriving = incoming.current.get(playerId);
      return arriving && arriving.until > Date.now() ? arriving.from : null;
    },
    [],
  );

  // ---------- camera ----------
  const pigSeat = state.phase === "roundEnd" || state.phase === "final" ? state.players.find((player) => player.id === state.lastRound?.pigId)?.seat ?? null : null;
  const view = useMemo(() => {
    if (povSeat !== null && offeredTo && target?.seat != null) {
      const pose = fanPose(restPos[target.seat], offeredTo, target.cardCount, aspect);
      const position = offeredTo.clone().addScaledVector(pose.position.clone().sub(offeredTo).normalize(), -0.15);
      position.y += 0.05;
      return { position, look: pose.position };
    }
    const portrait = aspect < 0.8;
    // On a phone the lobby / result panel covers the lower half: aim lower so the table sits up top.
    const sheetUp = portrait && state.phase !== "dealing" && state.phase !== "playing";
    if (pigSeat !== null) {
      const angle = angleOf(pigSeat);
      const look = onCircle(angle, SEAT_R, sheetUp ? 1.05 : 1.85);
      return { position: onCircle(angle, SEAT_R - 2.3, 2.7), look };
    }
    return {
      position: onCircle(0, portrait ? 8.6 : 6.6, portrait ? 8.2 : 5.4),
      look: new THREE.Vector3(0, sheetUp ? -1.9 : 0.9, portrait ? (sheetUp ? 1.2 : -0.2) : -0.5),
    };
  }, [povSeat, offeredTo, target?.seat, target?.cardCount, restPos, aspect, pigSeat, angleOf, state.phase]);

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
      <CameraRig position={view.position} look={view.look} />

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
                <Html position={onCircle(angle, SEAT_R, 1.35)} center zIndexRange={[25, 0]}>
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
                </Html>
              )}
            </group>
          );
        }
        const isMe = player.id === myId;
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
          drawing: turn?.drawerId === player.id,
          beingDrawn: turn?.targetId === player.id,
          ready: player.ready,
          showReady: inLobby && !player.isBot,
          turnEndsAt: turn?.drawerId === player.id ? turn.endsAt : null,
        };
        const isTarget = turn?.targetId === player.id;
        const offered = isTarget ? offeredTo : null;
        // Your own cards are the hand at the bottom of the screen; in 3D they only appear held out to a drawer.
        const showFan = !isMe || (isTarget && !!offeredTo);
        const dealt = dealCounts.current[player.id] ?? player.cardCount;
        const count = dealing ? Math.min(dealt, Math.ceil(dealt * dealProgress)) : isMe ? props.myHandCount : player.cardCount;
        return (
          <group key={player.id}>
            {!isMe && (
              <PigAvatar
                seat={seat}
                angle={angle}
                status={status}
                emote={latestEmote(player.id)}
                hidden={povSeat === seat}
                lobby={
                  inLobby && lobby.isHost && player.isBot ? (
                    <Html position={[0, 3.45, 0]} center zIndexRange={[25, 0]}>
                      <button
                        type="button"
                        onClick={() => lobby.onRemoveBot(player.id)}
                        className="rounded-full bg-red-500/90 px-2.5 py-1 text-[11px] font-bold text-white shadow transition hover:bg-red-500"
                      >
                        ✕ Mời bot ra
                      </button>
                    </Html>
                  ) : null
                }
              />
            )}
            {showFan && count > 0 && (
              <Fan
                count={count}
                restPos={restPos[seat]}
                offeredTo={offered}
                aspect={aspect}
                highlight={isTarget ? props.highlight : null}
                teased={state.teased[player.id] ?? null}
                interactive={isTarget && iDraw}
                onHover={props.onHover}
                onTap={props.onTap}
                revealCard={roundPigId === player.id ? 52 : null}
                getIncoming={getIncoming(player.id)}
                register={registerFor(player.id)}
              />
            )}
          </group>
        );
      })}

      {/* your own seat: a ring on the felt, and a label while choosing seats */}
      {me?.seat != null && (
        <>
          <mesh position={onCircle(0, SEAT_R - 0.9, TABLE_TOP + 0.005)} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.32, 0.4, 32]} />
            <meshBasicMaterial color={SEAT_COLORS[me.seat % SEAT_COLORS.length]} transparent opacity={0.6} />
          </mesh>
          {inLobby && (
            <Html position={onCircle(0, SEAT_R - 0.9, TABLE_TOP + 0.4)} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
              <span className="whitespace-nowrap rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-amber-950 shadow-lg">🫵 Bạn ngồi đây</span>
            </Html>
          )}
        </>
      )}

      {flyers.map((flyer) => (
        <Flyer key={flyer.key} from={flyer.from} card={flyer.card} onDone={() => setFlyers((current) => current.filter((item) => item.key !== flyer.key))} />
      ))}
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
