"use client";

// Keyboard + mouse (desktop) and touch (joystick + 2 buttons) input.
// Controls, per the user's explicit design: mouse aims AND kicks (click,
// hold to charge — a quick tap reads as a soft pass, a full charge as a
// hard shot, one unified action rather than separate pass/shoot buttons),
// Shift sprints, Space tackles. Mirrors the shape of tank's useTankInput.ts
// (held-movement ref + mouse-aim conversion) but smaller: no boost-drain UI
// concerns beyond the meter itself, and kick/tackle have no cooldown-based
// repeat-fire like tank's shooting does.

import { useEffect, useRef } from "react";
import { SOCCER_FIELD_H, SOCCER_FIELD_W, type SoccerClientMessage, type SoccerPublicState } from "@shared/soccerTypes";

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
  send: (msg: SoccerClientMessage) => void;
  selfId: string;
  stateRef: { current: SoccerPublicState };
  canvasRef: { current: HTMLCanvasElement | null };
}

export function useSoccerInput({ send, selfId, stateRef, canvasRef }: Params) {
  const heldRef = useRef({ up: false, down: false, left: false, right: false, boost: false });
  const lastSentInputRef = useRef("");
  // null = no mouse aim yet (or a touch device) — the server falls back to
  // the held-movement direction in that case, same idea as tank's aimAngle.
  const aimAngleRef = useRef<number | null>(null);

  function sendInput() {
    const held = heldRef.current;
    const angleBucket = aimAngleRef.current === null ? "n" : Math.round(aimAngleRef.current * 40);
    const key = `${held.up}${held.down}${held.left}${held.right}${held.boost}:${angleBucket}`;
    if (key === lastSentInputRef.current) return;
    lastSentInputRef.current = key;
    send({ type: "input", ...held, aimAngle: aimAngleRef.current ?? undefined });
  }

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
        send({ type: "tackle" });
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
      }
    }
    function onBlur() {
      held.up = held.down = held.left = held.right = held.boost = false;
      sendInput();
      send({ type: "kick_release" });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [send]);

  // Desktop mouse aim: the canvas has no camera offset (the whole field is
  // always fully visible, see SoccerCanvas), so converting a mouse position
  // to a world angle is just a straight coordinate-space rescale — no
  // camera-clamp math to redo, unlike tank's version of this.
  function handleAimMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const self = stateRef.current.players.find((p) => p.id === selfId);
    if (!canvas || !self) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const mouseX = ((e.clientX - rect.left) / rect.width) * SOCCER_FIELD_W;
    const mouseY = ((e.clientY - rect.top) / rect.height) * SOCCER_FIELD_H;
    aimAngleRef.current = Math.atan2(mouseY - self.y, mouseX - self.x);
    sendInput();
  }
  function handleAimLeave() {
    aimAngleRef.current = null;
    sendInput();
  }
  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return;
    send({ type: "kick_start" });
  }
  function handleMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return;
    send({ type: "kick_release" });
  }

  // Touch controls: joystick for movement (no aim — server falls back to
  // movement direction, see stepPlayers) plus hold-to-kick and tap-to-tackle
  // buttons, same shape as tank's touch layer.
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

  function setBoost(active: boolean) {
    heldRef.current.boost = active;
    sendInput();
  }

  return {
    heldRef,
    joyBaseRef,
    joyKnobRef,
    handleJoyPointerDown,
    handleJoyPointerMove,
    resetJoystick,
    setBoost,
    handleAimMove,
    handleAimLeave,
    handleMouseDown,
    handleMouseUp,
    startKick: () => send({ type: "kick_start" }),
    releaseKick: () => send({ type: "kick_release" }),
    tackle: () => send({ type: "tackle" }),
  };
}
