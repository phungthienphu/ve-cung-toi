"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { EMOTES, type Emote } from "@shared/oldMaidTypes";
import { SEAT_R, onCircle } from "./cards3d";
import { Label } from "./Label";

// A chibi pig sitting at the table, built from spheres and cones. Each seat has
// its own shirt and hat so players are easy to tell apart. It never reacts on
// its own to what it holds — only emotes the player sends — so nothing gives
// the Joker away.

export const SEAT_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#14b8a6"];
const SKIN = "#f7a8b8";
const SKIN_DARK = "#ec8aa2";

export interface AvatarStatus {
  name: string;
  cardCount: number;
  isHost: boolean;
  isBot: boolean;
  standIn: boolean;
  connected: boolean;
  disconnectedUntil: number | null;
  /** Finishing place this round, once out. */
  place: number | null;
  /** Wears the pig crown (last round's pig, or this round's at the reveal). */
  crowned: boolean;
  /** Just crowned: mud, droop, spotlight. */
  shamed: boolean;
  drawing: boolean;
  beingDrawn: boolean;
  ready: boolean;
  showReady: boolean;
  turnEndsAt: number | null;
}

function Hat({ style, color }: { style: number; color: string }) {
  switch (style % 6) {
    case 0: // nón lá
      return (
        <mesh position={[0, 2.18, 0]} castShadow>
          <coneGeometry args={[0.62, 0.32, 24]} />
          <meshStandardMaterial color="#e9d9a8" roughness={0.9} />
        </mesh>
      );
    case 1: // beanie with a bobble
      return (
        <group position={[0, 2.08, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.43, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={color} roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.45, 0]}>
            <sphereGeometry args={[0.1, 12, 10]} />
            <meshStandardMaterial color="#fff" />
          </mesh>
        </group>
      );
    case 2: // top hat
      return (
        <group position={[0, 2.2, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.46, 0.46, 0.04, 24]} />
            <meshStandardMaterial color="#1f1b24" />
          </mesh>
          <mesh position={[0, 0.22, 0]} castShadow>
            <cylinderGeometry args={[0.28, 0.3, 0.42, 24]} />
            <meshStandardMaterial color="#1f1b24" />
          </mesh>
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.305, 0.305, 0.08, 24]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </group>
      );
    case 3: // big bow
      return (
        <group position={[0.18, 2.12, 0.05]} rotation={[0, 0, -0.3]}>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.13, 0, 0]} rotation={[0, 0, (side * Math.PI) / 2]}>
              <coneGeometry args={[0.12, 0.24, 12]} />
              <meshStandardMaterial color={color} />
            </mesh>
          ))}
          <mesh>
            <sphereGeometry args={[0.06, 10, 8]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </group>
      );
    case 4: // headband
      return (
        <mesh position={[0, 1.98, 0]} rotation={[0.15, 0, 0]}>
          <torusGeometry args={[0.41, 0.045, 10, 32]} />
          <meshStandardMaterial color={color} />
        </mesh>
      );
    default: // cap with a brim
      return (
        <group position={[0, 2.06, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.42, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[0, 0.02, 0.36]} rotation={[0.25, 0, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.03, 20, 1, false, -Math.PI / 2, Math.PI]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </group>
      );
  }
}

function PigCrown() {
  return (
    <group position={[0, 2.3, 0]}>
      <mesh>
        <cylinderGeometry args={[0.3, 0.34, 0.16, 20, 1, true]} />
        <meshStandardMaterial color="#f9a8d4" metalness={0.4} roughness={0.35} side={THREE.DoubleSide} emissive="#be185d" emissiveIntensity={0.25} />
      </mesh>
      {Array.from({ length: 6 }, (_, index) => {
        const angle = (index / 6) * Math.PI * 2;
        return (
          <mesh key={index} position={[Math.sin(angle) * 0.31, 0.15, Math.cos(angle) * 0.31]}>
            <coneGeometry args={[0.06, 0.16, 8]} />
            <meshStandardMaterial color="#f472b6" metalness={0.4} roughness={0.3} />
          </mesh>
        );
      })}
    </group>
  );
}

function TurnRing({ endsAt }: { endsAt: number }) {
  const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  return <span className="ml-1 rounded-full bg-amber-300 px-1.5 text-[11px] font-black text-amber-950">{left}s</span>;
}

export function PigAvatar({
  seat,
  angle,
  status,
  emote,
  lobby,
}: {
  seat: number;
  angle: number;
  status: AvatarStatus;
  emote: { emote: Emote; at: number } | null;
  lobby: React.ReactNode;
}) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const lids = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const color = SEAT_COLORS[seat % SEAT_COLORS.length];
  const position = useMemo(() => onCircle(angle, SEAT_R, 0), [angle]);
  const phase = useMemo(() => seat * 1.7, [seat]);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime + phase;
    const k = 1 - Math.exp(-delta * 6);
    if (root.current) {
      root.current.position.copy(position);
      root.current.lookAt(0, 0, 0);
    }
    if (body.current) {
      const celebrating = status.place !== null && !status.shamed;
      // Leaning in too far would push the snout through the cards it holds.
      const lean = status.drawing ? 0.12 : status.shamed ? -0.12 : 0;
      body.current.rotation.x += (lean - body.current.rotation.x) * k;
      const hop = celebrating ? Math.max(0, Math.sin(t * 6)) * 0.12 : 0;
      body.current.position.y = Math.sin(t * 1.6) * 0.025 + hop;
      body.current.scale.y = 1 + Math.sin(t * 1.6) * 0.012 - (status.shamed ? 0.06 : 0);
    }
    if (lids.current) {
      const blink = (t % 4.2) < 0.12;
      lids.current.scale.y = blink ? 1 : 0.05;
    }
    const raise = status.place !== null && !status.shamed ? -2.4 : status.drawing ? -1.1 : -0.75;
    for (const arm of [armL.current, armR.current]) {
      if (arm) arm.rotation.x += (raise - arm.rotation.x) * k;
    }
  });

  const showEmote = emote && Date.now() - emote.at < 2400;
  const secondsLeft = status.disconnectedUntil ? Math.max(0, Math.ceil((status.disconnectedUntil - Date.now()) / 1000)) : 0;

  return (
    <group ref={root}>
      {/* stool */}
      <mesh position={[0, 0.35, -0.15]} castShadow receiveShadow>
        <cylinderGeometry args={[0.45, 0.5, 0.7, 20]} />
        <meshStandardMaterial color="#5a3418" roughness={0.85} />
      </mesh>
      <group ref={body}>
        {/* shirt */}
        <mesh position={[0, 1.05, -0.1]} scale={[0.62, 0.62, 0.52]} castShadow>
          <sphereGeometry args={[0.8, 24, 18]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
        {/* arms reaching for the cards */}
        {[
          { ref: armL, x: 0.42 },
          { ref: armR, x: -0.42 },
        ].map(({ ref, x }) => (
          <group key={x} ref={ref} position={[x, 1.3, 0.05]} rotation={[-0.75, 0, x > 0 ? -0.2 : 0.2]}>
            <mesh position={[0, -0.25, 0]} castShadow>
              <capsuleGeometry args={[0.1, 0.36, 4, 10]} />
              <meshStandardMaterial color={color} roughness={0.8} />
            </mesh>
            <mesh position={[0, -0.5, 0]}>
              <sphereGeometry args={[0.1, 12, 10]} />
              <meshStandardMaterial color={SKIN} />
            </mesh>
          </group>
        ))}
        {/* head */}
        <group position={[0, 1.78, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.44, 28, 20]} />
            <meshStandardMaterial color={SKIN} roughness={0.7} />
          </mesh>
          {/* ears */}
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.27, 0.34, -0.02]} rotation={[0.2, 0, side * -0.5]}>
              <coneGeometry args={[0.12, 0.24, 12]} />
              <meshStandardMaterial color={SKIN_DARK} />
            </mesh>
          ))}
          {/* snout */}
          <mesh position={[0, -0.06, 0.4]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.17, 0.18, 0.12, 20]} />
            <meshStandardMaterial color={SKIN_DARK} roughness={0.6} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.06, -0.06, 0.465]}>
              <sphereGeometry args={[0.035, 10, 8]} />
              <meshStandardMaterial color="#7a2440" />
            </mesh>
          ))}
          {/* eyes */}
          {[-1, 1].map((side) => (
            <group key={side} position={[side * 0.16, 0.1, 0.36]}>
              <mesh>
                <sphereGeometry args={[0.075, 14, 12]} />
                <meshStandardMaterial color="#ffffff" />
              </mesh>
              <mesh position={[0, 0, 0.05]}>
                <sphereGeometry args={[0.04, 12, 10]} />
                <meshStandardMaterial color="#1f1300" />
              </mesh>
            </group>
          ))}
          <group ref={lids} position={[0, 0.17, 0.38]}>
            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * 0.16, -0.06, 0]} scale={[1, 1, 0.6]}>
                <sphereGeometry args={[0.08, 12, 10]} />
                <meshStandardMaterial color={SKIN} />
              </mesh>
            ))}
          </group>
          {/* blush */}
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.27, -0.08, 0.31]} rotation={[0, side * 0.6, 0]}>
              <circleGeometry args={[0.06, 14]} />
              <meshBasicMaterial color="#ff7aa0" transparent opacity={0.55} />
            </mesh>
          ))}
          {/* mud for a fresh pig */}
          {status.shamed &&
            [
              [0.18, 0.22, 0.34],
              [-0.25, -0.15, 0.3],
              [0.05, 0.38, 0.2],
            ].map(([x, y, z], index) => (
              <mesh key={index} position={[x, y, z]}>
                <sphereGeometry args={[0.08 + index * 0.02, 10, 8]} />
                <meshStandardMaterial color="#5b3a1a" roughness={1} />
              </mesh>
            ))}
        </group>
        {status.crowned ? <PigCrown /> : <Hat style={seat} color={color} />}
      </group>

      {/* name tag, status, emote */}
      <Label position={[0, 2.95, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
        <div className="flex flex-col items-center gap-1 whitespace-nowrap select-none">
          {showEmote && (
            <span key={emote!.at} className="om-emote text-4xl drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
              {EMOTES[emote!.emote]}
            </span>
          )}
          <div
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shadow-lg ring-1 ${
              status.drawing ? "bg-amber-300 text-amber-950 ring-amber-100" : status.beingDrawn ? "bg-white text-[#3b1d0b] ring-amber-300" : "bg-black/60 text-white ring-white/15"
            }`}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
            {status.isHost && <span>👑</span>}
            {(status.isBot || status.standIn) && <span>🤖</span>}
            <span className="max-w-[7.5rem] truncate">{status.name}</span>
            {status.place === null && status.cardCount > 0 && <span className="rounded-full bg-white/20 px-1.5 text-[11px]">🂠 {status.cardCount}</span>}
            {status.place !== null && !status.shamed && <span className="rounded-full bg-emerald-400 px-1.5 text-[11px] text-emerald-950">#{status.place}</span>}
            {status.drawing && status.turnEndsAt && <TurnRing endsAt={status.turnEndsAt} />}
          </div>
          {!status.connected && !status.isBot && !status.standIn && (
            <span className="rounded-full bg-red-500/90 px-2 py-0.5 text-[10px] font-bold text-white">📡 mất kết nối {secondsLeft ? `(${secondsLeft}s)` : ""}</span>
          )}
          {status.showReady && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${status.ready ? "bg-emerald-400 text-emerald-950" : "bg-white/20 text-white/80"}`}>
              {status.ready ? "✓ Sẵn sàng" : "Đang chờ…"}
            </span>
          )}
        </div>
      </Label>
      {lobby}
    </group>
  );
}
