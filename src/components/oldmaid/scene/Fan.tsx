"use client";

import { Html, useCursor } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { cardGeometry, faceMaterial, fanLayout, getBackMaterial, getGlowTexture, glowGeometry, offerDistance, type FanSlot } from "./cards3d";

// One player's hand as a fan of card backs. Resting, it's held in front of
// the pig; when it's being drawn from it floats up in front of the drawer's
// eyes, opened wide. The slot being pointed at (by the drawer, live) lifts
// out and glows gold, like the cards on Bà Đồng's table.

const dummy = new THREE.Object3D();

export interface FanProps {
  count: number;
  restPos: THREE.Vector3;
  /** Set when this hand is being drawn from: where the drawer's eyes are. */
  offeredTo: THREE.Vector3 | null;
  aspect: number;
  highlight: number | null;
  teased: number | null;
  interactive: boolean;
  onHover?: (slot: number | null) => void;
  onTap?: (slot: number, mouse: boolean) => void;
  /** Turn the last card face up for everyone (the pig's Joker at the reveal). */
  revealCard: number | null;
  /** Where a card that just appeared flies in from (the deck while dealing, the drawn-from hand after a draw). */
  getIncoming?: () => THREE.Vector3 | null;
  register?: (group: THREE.Group | null) => void;
}

/** Where a fan sits and faces: held in front of its owner, or offered to a drawer. */
export function fanPose(restPos: THREE.Vector3, offeredTo: THREE.Vector3 | null, count: number, aspect: number) {
  if (!offeredTo) {
    dummy.position.copy(restPos);
    dummy.lookAt(0, restPos.y, 0);
  } else {
    const direction = restPos.clone().sub(offeredTo).normalize();
    dummy.position.copy(offeredTo).addScaledVector(direction, offerDistance(count, aspect));
    dummy.position.y = offeredTo.y - 0.12;
    dummy.lookAt(offeredTo);
  }
  return { position: dummy.position.clone(), quaternion: dummy.quaternion.clone() };
}

function FanCard({
  slot,
  layout,
  highlighted,
  teased,
  interactive,
  reveal,
  fan,
  getIncoming,
  onHover,
  onTap,
}: {
  slot: number;
  layout: FanSlot;
  highlighted: boolean;
  teased: boolean;
  interactive: boolean;
  reveal: number | null;
  fan: React.RefObject<THREE.Group | null>;
  getIncoming?: () => THREE.Vector3 | null;
  onHover?: (slot: number | null) => void;
  onTap?: (slot: number, mouse: boolean) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const lift = useRef<THREE.Group>(null);
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  const placed = useRef(false);
  const [pointed, setPointed] = useState(false);
  useCursor(pointed && interactive);

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-delta * 9);
    if (group.current && !placed.current) {
      // First frame (after the table has processed the event that brought this card):
      // start where it came from and glide into place, or just appear in place.
      placed.current = true;
      const from = getIncoming?.();
      if (from && fan.current) {
        fan.current.updateWorldMatrix(true, false);
        group.current.position.copy(fan.current.worldToLocal(from.clone()));
        group.current.rotation.z = Math.PI * 0.5;
      } else {
        group.current.position.set(layout.x, layout.y, layout.z);
        group.current.rotation.z = layout.tilt;
      }
      group.current.visible = true;
    }
    if (group.current) {
      group.current.position.x += (layout.x - group.current.position.x) * k;
      group.current.position.y += (layout.y - group.current.position.y) * k;
      group.current.position.z += (layout.z - group.current.position.z) * k;
      group.current.rotation.z += (layout.tilt - group.current.rotation.z) * k;
    }
    if (lift.current) {
      const up = highlighted ? 0.18 : teased ? 0.32 : 0;
      const out = highlighted ? 0.1 : teased ? 0.04 : 0;
      const scale = highlighted ? 1.08 : 1;
      lift.current.position.y += (up - lift.current.position.y) * k;
      lift.current.position.z += (out - lift.current.position.z) * k;
      lift.current.scale.setScalar(lift.current.scale.x + (scale - lift.current.scale.x) * k);
    }
    if (glow.current) {
      const target = highlighted ? 1 : teased ? 0.4 : 0;
      glow.current.opacity += (target - glow.current.opacity) * k;
    }
  });

  const handlers = interactive
    ? {
        onPointerOver: (event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation();
          setPointed(true);
          if (event.pointerType === "mouse") onHover?.(slot);
        },
        onPointerOut: (event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation();
          setPointed(false);
          if (event.pointerType === "mouse") onHover?.(null);
        },
        onClick: (event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation();
          onTap?.(slot, (event.nativeEvent as PointerEvent).pointerType === "mouse");
        },
      }
    : {};

  return (
    <group ref={group} visible={false}>
      <group ref={lift}>
        <mesh geometry={glowGeometry} position={[0, 0, -0.012]} renderOrder={2}>
          <meshBasicMaterial ref={glow} map={getGlowTexture()} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh geometry={cardGeometry} material={reveal !== null ? faceMaterial(reveal) : getBackMaterial()} position={[0, 0, 0.001]} castShadow {...handlers} />
        <mesh geometry={cardGeometry} material={getBackMaterial()} position={[0, 0, -0.001]} rotation={[0, Math.PI, 0]} />
        {teased && (
          <Html position={[0, 0.62, 0.02]} center zIndexRange={[15, 0]} style={{ pointerEvents: "none" }}>
            <span className="om-tease rounded-full bg-pink-500 px-2 py-0.5 text-xs font-black text-white shadow-lg">☝️ nhử</span>
          </Html>
        )}
      </group>
    </group>
  );
}

export function Fan({ count, restPos, offeredTo, aspect, highlight, teased, interactive, onHover, onTap, revealCard, getIncoming, register }: FanProps) {
  const group = useRef<THREE.Group>(null);
  const layout = useMemo(() => fanLayout(count, !!offeredTo, aspect), [count, offeredTo, aspect]);
  const pose = useMemo(() => fanPose(restPos, offeredTo, count, aspect), [restPos, offeredTo, count, aspect]);
  const placed = useRef(false);

  useLayoutEffect(() => {
    register?.(group.current);
    return () => register?.(null);
  }, [register]);

  useFrame((_, delta) => {
    if (!group.current) return;
    if (!placed.current) {
      group.current.position.copy(pose.position);
      group.current.quaternion.copy(pose.quaternion);
      placed.current = true;
      return;
    }
    const k = 1 - Math.exp(-delta * 4.5);
    group.current.position.lerp(pose.position, k);
    group.current.quaternion.slerp(pose.quaternion, k);
  });

  return (
    <group ref={group}>
      {layout.map((slot, index) => (
        <FanCard
          key={index}
          slot={index}
          layout={slot}
          highlighted={highlight === index}
          teased={teased === index}
          interactive={interactive}
          reveal={revealCard !== null && count === 1 ? revealCard : null}
          fan={group}
          getIncoming={getIncoming}
          onHover={onHover}
          onTap={onTap}
        />
      ))}
    </group>
  );
}
