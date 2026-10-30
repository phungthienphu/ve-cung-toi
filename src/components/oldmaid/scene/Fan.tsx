"use client";

import { useCursor } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { FAN_Y, cardGeometry, faceMaterial, fanLayout, getBackMaterial, getGlowTexture, glowGeometry, offerDistance, type FanMode, type FanSlot } from "./cards3d";
import { Label } from "./Label";

// One player's hand as a fan of card backs. Resting, it's held in front of
// the pig; when it's being drawn from it's held out to the drawer — right in
// front of your eyes if that's you, across the felt for everyone else. The
// slot being pointed at (by the drawer, live) lifts out and glows gold, like
// the cards on Bà Đồng's table; a dangled card ("nhử") bobs up and down.

const dummy = new THREE.Object3D();

export interface FanOffer {
  /** The drawer's eyes. */
  to: THREE.Vector3;
  /** You're the drawer: the fan fills your view. Otherwise it's held out over the table, turned towards `face`. */
  pov: boolean;
  face: THREE.Vector3;
}

export interface FanProps {
  count: number;
  restPos: THREE.Vector3;
  /** Set while this hand is being drawn from. */
  offer: FanOffer | null;
  aspect: number;
  highlight: number | null;
  teased: number | null;
  /** The owner is checking a card they just drew against this hand: a ripple runs along it. */
  scanning: boolean;
  interactive: boolean;
  onHover?: (slot: number | null) => void;
  onTap?: (slot: number, mouse: boolean) => void;
  /** At the end of a round: the cards still held, face up for everyone, slot by slot. */
  revealCards: number[] | null;
  /** A card you looked at with 🔍: face up on the side facing you, only on your screen. */
  revealSlot: { slot: number; card: number } | null;
  /** A card someone looked at with 🔍 this turn: tagged for everyone. */
  markSlot: number | null;
  /** Where a card that just appeared flies in from (the deck while dealing, the drawer's fingers after a draw). */
  getIncoming?: () => THREE.Vector3 | null;
  register?: (group: THREE.Group | null) => void;
}

/** Where a fan sits and faces: held in front of its owner, or offered to a drawer. */
export function fanPose(restPos: THREE.Vector3, offer: FanOffer | null, count: number, aspect: number) {
  if (!offer) {
    dummy.position.copy(restPos);
    dummy.lookAt(0, restPos.y, 0);
  } else if (offer.pov) {
    const direction = restPos.clone().sub(offer.to).normalize();
    dummy.position.copy(offer.to).addScaledVector(direction, offerDistance(count, aspect));
    dummy.position.y = offer.to.y - 0.12;
    dummy.lookAt(offer.to);
  } else {
    dummy.position.copy(restPos).lerp(offer.to, 0.4);
    dummy.position.y = FAN_Y + 0.3;
    dummy.lookAt(offer.face);
  }
  return { position: dummy.position.clone(), quaternion: dummy.quaternion.clone() };
}

function FanCard({
  slot,
  layout,
  highlighted,
  teased,
  scanning,
  interactive,
  reveal,
  marked,
  fan,
  slots,
  getIncoming,
  onHover,
  onTap,
}: {
  slot: number;
  layout: FanSlot;
  highlighted: boolean;
  teased: boolean;
  scanning: boolean;
  interactive: boolean;
  reveal: number | null;
  marked: boolean;
  fan: React.RefObject<THREE.Group | null>;
  /** Filled with each card's world position while the hand is held out, so a drawn card can fly from where it was. */
  slots: THREE.Vector3[] | null;
  getIncoming?: () => THREE.Vector3 | null;
  onHover?: (slot: number | null) => void;
  onTap?: (slot: number, mouse: boolean) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const lift = useRef<THREE.Group>(null);
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  const placed = useRef(false);
  const eased = useRef({ up: 0, out: 0, scale: 1, tease: 0, scan: 0 });
  const [pointed, setPointed] = useState(false);
  useCursor(pointed && interactive);

  useFrame(({ clock }, delta) => {
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
    const time = clock.elapsedTime;
    const bounce = Math.abs(Math.sin(time * 4.2));
    if (lift.current) {
      const e = eased.current;
      e.up += ((highlighted ? 0.18 : 0) - e.up) * k;
      e.out += ((highlighted ? 0.1 : teased ? 0.05 : 0) - e.out) * k;
      e.scale += ((highlighted ? 1.08 : 1) - e.scale) * k;
      e.tease += ((teased ? 1 : 0) - e.tease) * k;
      e.scan += ((scanning ? 1 : 0) - e.scan) * k;
      // Dangled: pops up and dips back, again and again, to catch the drawer's eye.
      const bob = e.tease * (0.06 + 0.24 * bounce);
      const ripple = e.scan * 0.07 * Math.max(0, Math.sin(time * 9 - slot * 0.8));
      lift.current.position.set(0, e.up + bob + ripple, e.out);
      lift.current.scale.setScalar(e.scale);
      if (slots) {
        slots[slot] ??= new THREE.Vector3();
        lift.current.getWorldPosition(slots[slot]);
      }
    }
    if (glow.current) {
      const target = highlighted ? 1 : teased ? 0.25 + 0.35 * bounce : 0;
      glow.current.opacity += (target - glow.current.opacity) * Math.min(1, k * 2);
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
          <Label position={[0, 0.62, 0.02]} zIndexRange={[15, 0]} style={{ pointerEvents: "none" }}>
            <span className="om-tease rounded-full bg-pink-500 px-2 py-0.5 text-xs font-black text-white shadow-lg">☝️ nhử</span>
          </Label>
        )}
        {marked && (
          <Label position={[0, -0.55, 0.02]} zIndexRange={[15, 0]} style={{ pointerEvents: "none" }}>
            <span className="rounded-full bg-sky-400 px-2 py-0.5 text-xs font-black text-sky-950 shadow-lg">🔍 bị soi</span>
          </Label>
        )}
      </group>
    </group>
  );
}

export function Fan({ count, restPos, offer, aspect, highlight, teased, scanning, interactive, onHover, onTap, revealCards, revealSlot, markSlot, getIncoming, register }: FanProps) {
  const group = useRef<THREE.Group>(null);
  const slots = useRef<THREE.Vector3[]>([]);
  const mode: FanMode = !offer ? "rest" : offer.pov ? "pov" : "table";
  const layout = useMemo(() => fanLayout(count, mode, aspect), [count, mode, aspect]);
  const pose = useMemo(() => fanPose(restPos, offer, count, aspect), [restPos, offer, count, aspect]);
  const placed = useRef(false);

  useLayoutEffect(() => {
    if (group.current) group.current.userData.slots = slots.current;
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
          scanning={scanning}
          interactive={interactive}
          reveal={revealCards?.[index] ?? (revealSlot?.slot === index ? revealSlot.card : null)}
          marked={markSlot === index}
          fan={group}
          slots={offer ? slots.current : null}
          getIncoming={getIncoming}
          onHover={onHover}
          onTap={onTap}
        />
      ))}
    </group>
  );
}
