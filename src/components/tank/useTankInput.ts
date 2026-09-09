"use client";

// All player input handling: keyboard (desktop), the virtual joystick +
// hold-to-fire/boost buttons (touch), and desktop mouse-aim/click-to-fire.
// Everything here just ends up calling `send` with an "input"/"shoot"/
// "use_item" message — none of it touches rendering directly, except
// `cameraOffsetRef`, which the draw loop writes into every frame so mouse-aim
// can convert a screen position into a world angle without redoing the
// camera-clamp math itself.

import { useCallback, useEffect, useRef } from "react";
import {
  FIRE_COOLDOWN_MS,
  RAPID_FIRE_COOLDOWN_MS,
  ULTIMATE_ACTIVATION_MODE,
  ULTIMATE_CONFIG,
  VIEWPORT_H,
  VIEWPORT_W,
  skinForColor,
  type TankClientMessage,
  type TankPublicState,
} from "@shared/tankTypes";
import { playTankBigShot, playTankShoot } from "@/lib/sound";

const KEY_MAP: Record<string, "up" | "down" | "left" | "right"> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
  W: "up",
  S: "down",
  A: "left",
  D: "right",
};

const JOY_DEAD_ZONE = 12;

function angleToDir(dx: number, dy: number): "up" | "down" | "left" | "right" {
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (deg >= -45 && deg < 45) return "right";
  if (deg >= 45 && deg < 135) return "down";
  if (deg >= -135 && deg < -45) return "up";
  return "left";
}

interface Params {
  send: (msg: TankClientMessage) => void;
  selfId: string;
  stateRef: { current: TankPublicState };
  canvasRef: { current: HTMLCanvasElement | null };
}

export function useTankInput({ send, selfId, stateRef, canvasRef }: Params) {
  // Shared with the touch joystick/boost button below — both the keyboard
  // listener and the touch handlers mutate this same object so either input
  // method (or a mix, e.g. keyboard + touch on a hybrid device) works.
  const heldRef = useRef({ up: false, down: false, left: false, right: false, boost: false });
  const lastSentInputRef = useRef("");
  // Desktop-only mouse aim: null means "no mouse aim active, fire along the
  // 4-directional facing instead" (touch devices never set this).
  const aimAngleRef = useRef<number | null>(null);
  // Updated every draw() frame by the caller so handleAimMove (which runs
  // outside the rAF loop) can convert a screen-space mouse position into a
  // world angle without redoing the camera-clamp math itself.
  const cameraOffsetRef = useRef({ x: 0, y: 0 });

  const sendInput = useCallback(() => {
    const held = heldRef.current;
    const angle = aimAngleRef.current;
    const angleBucket = angle === null ? "n" : Math.round(angle * 40);
    const key = `${held.up}${held.down}${held.left}${held.right}${held.boost}:${angleBucket}`;
    if (key === lastSentInputRef.current) return;
    lastSentInputRef.current = key;
    send({ type: "input", ...held, aimAngle: angle ?? undefined });
  }, [send]);

  useEffect(() => {
    const held = heldRef.current;

    function onKeyDown(e: KeyboardEvent) {
      const dir = KEY_MAP[e.key];
      if (dir) {
        if (!held[dir]) {
          held[dir] = true;
          sendInput();
        }
        e.preventDefault();
      } else if (e.key === "Shift") {
        if (!held.boost) {
          held.boost = true;
          sendInput();
        }
      } else if (e.key === " " && !e.repeat) {
        send({ type: "shoot" });
        playTankShoot();
        e.preventDefault();
      } else if (["1", "2", "3"].includes(e.key)) {
        const self = stateRef.current.players.find((p) => p.id === selfId);
        const kind = self?.items[Number(e.key) - 1];
        if (kind) send({ type: "use_item", kind });
        e.preventDefault();
      } else if ((e.key === "r" || e.key === "R") && !e.repeat) {
        const self = stateRef.current.players.find((p) => p.id === selfId);
        if (!self || self.ultimateEnergy < ULTIMATE_CONFIG[skinForColor(self.color)].maxEnergy) return;
        if (ULTIMATE_ACTIVATION_MODE[skinForColor(self.color)] === "charge") {
          send({ type: "charge_ultimate" });
        } else {
          send({ type: "shoot", big: true });
          playTankBigShot();
        }
        e.preventDefault();
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      const dir = KEY_MAP[e.key];
      if (dir) {
        held[dir] = false;
        sendInput();
      } else if (e.key === "Shift") {
        held.boost = false;
        sendInput();
      } else if (e.key === "r" || e.key === "R") {
        // Only meaningful for a "charge" skin (see ULTIMATE_ACTIVATION_MODE)
        // that's actually mid-charge — releasing R for every other skin is a
        // no-op since onKeyDown already fired/activated on press.
        const self = stateRef.current.players.find((p) => p.id === selfId);
        if (self && self.sniperChargingSince !== null) {
          send({ type: "shoot", big: true });
          playTankBigShot();
        }
      }
    }
    function onBlur() {
      held.up = held.down = held.left = held.right = held.boost = false;
      sendInput();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      send({ type: "input", up: false, down: false, left: false, right: false, boost: false });
    };
  }, [send, selfId, sendInput, stateRef]);

  // Touch controls: a virtual joystick (resolved to the same 4-directional
  // input the server understands — no diagonal movement in this game) plus
  // hold-to-fire and hold-to-boost buttons. Hidden on pointer:fine devices
  // via the `md:hidden` classes in TankCanvas's JSX; a touch/mouse drag on a
  // hybrid device works too since these use Pointer Events.
  const joyBaseRef = useRef<HTMLDivElement | null>(null);
  const joyKnobRef = useRef<HTMLDivElement | null>(null);
  const joyActiveRef = useRef(false);

  function updateJoystick(clientX: number, clientY: number) {
    const base = joyBaseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const maxDist = rect.width / 2;
    if (dist > maxDist) {
      dx = (dx / dist) * maxDist;
      dy = (dy / dist) * maxDist;
    }
    if (joyKnobRef.current) {
      joyKnobRef.current.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }
    const dir = dist < JOY_DEAD_ZONE ? null : angleToDir(dx, dy);
    const held = heldRef.current;
    held.up = dir === "up";
    held.down = dir === "down";
    held.left = dir === "left";
    held.right = dir === "right";
    sendInput();
  }

  function resetJoystick() {
    joyActiveRef.current = false;
    const held = heldRef.current;
    held.up = held.down = held.left = held.right = false;
    if (joyKnobRef.current) joyKnobRef.current.style.transform = "translate(-50%, -50%)";
    sendInput();
  }

  function handleJoyPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    joyActiveRef.current = true;
    updateJoystick(e.clientX, e.clientY);
  }
  function handleJoyPointerMove(e: React.PointerEvent) {
    if (!joyActiveRef.current) return;
    updateJoystick(e.clientX, e.clientY);
  }

  // A self-rescheduling timeout rather than a fixed setInterval — each shot
  // re-checks whether the local tank's rapid-fire buff (Blue's ultimate) is
  // currently active and picks the matching cadence, so held-fire speeds up
  // and slows back down automatically without restarting the loop.
  const shootTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isShootingRef = useRef(false);
  function fireOnce() {
    send({ type: "shoot" });
    playTankShoot();
    const self = stateRef.current.players.find((p) => p.id === selfId);
    const isRapidFiring = !!self?.rapidFireUntil && self.rapidFireUntil > Date.now();
    const delay = isRapidFiring ? RAPID_FIRE_COOLDOWN_MS : FIRE_COOLDOWN_MS;
    shootTimeoutRef.current = setTimeout(() => {
      if (isShootingRef.current) fireOnce();
    }, delay);
  }
  function startShooting() {
    if (isShootingRef.current) return;
    isShootingRef.current = true;
    fireOnce();
  }
  function stopShooting() {
    isShootingRef.current = false;
    if (shootTimeoutRef.current) {
      clearTimeout(shootTimeoutRef.current);
      shootTimeoutRef.current = null;
    }
  }

  function setBoost(active: boolean) {
    heldRef.current.boost = active;
    sendInput();
  }

  // Desktop mouse-aim: shots fire toward the cursor instead of only the 4
  // movement directions. Converts the mouse's CSS-pixel position into the
  // canvas's logical VIEWPORT coordinate space (which can differ from the
  // canvas's displayed size on a responsive layout), then into a world
  // angle using the local tank's last-known world position.
  function handleAimMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const self = stateRef.current.players.find((p) => p.id === selfId);
    if (!canvas || !self) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const mouseX = ((e.clientX - rect.left) / rect.width) * VIEWPORT_W;
    const mouseY = ((e.clientY - rect.top) / rect.height) * VIEWPORT_H;
    const selfScreenX = self.x + cameraOffsetRef.current.x;
    const selfScreenY = self.y + cameraOffsetRef.current.y;
    aimAngleRef.current = Math.atan2(mouseY - selfScreenY, mouseX - selfScreenX);
    sendInput();
  }
  function handleAimLeave() {
    aimAngleRef.current = null;
    sendInput();
    stopShooting();
  }

  // Left-click to fire, in addition to Space — held down keeps firing at the
  // same cooldown-respecting rate as the touch fire button.
  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return;
    startShooting();
  }
  function handleMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return;
    stopShooting();
  }

  return {
    cameraOffsetRef,
    joyBaseRef,
    joyKnobRef,
    handleJoyPointerDown,
    handleJoyPointerMove,
    resetJoystick,
    setBoost,
    startShooting,
    stopShooting,
    handleAimMove,
    handleAimLeave,
    handleMouseDown,
    handleMouseUp,
  };
}
