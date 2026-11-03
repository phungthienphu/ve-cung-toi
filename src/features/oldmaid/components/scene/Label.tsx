"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import * as THREE from "three";

// HTML pinned to a point in the 3D scene (name tags, seat buttons), centred on
// it. Like drei's <Html>, but every mount gets a fresh element: drei reuses
// one element across React's mount → unmount → mount (StrictMode does that in
// development), and the late unmount of the first root wipes out the second,
// so labels randomly came up empty — e.g. a "＋ Ngồi đây" missing from a seat.

const world = new THREE.Vector3();
const toObject = new THREE.Vector3();
const facing = new THREE.Vector3();

export function Label({
  position,
  children,
  zIndexRange = [16, 0],
  style,
}: {
  position?: [number, number, number] | THREE.Vector3;
  children: ReactNode;
  /** z-index for the nearest and the farthest label: nearer ones stack on top. */
  zIndexRange?: [number, number];
  style?: CSSProperties;
}) {
  const group = useRef<THREE.Group>(null);
  const holder = useRef<HTMLDivElement | null>(null);
  const root = useRef<Root | null>(null);
  const last = useRef({ transform: "", zIndex: "", display: "" });
  const gl = useThree((s) => s.gl);
  const connected = useThree((s) => s.events.connected) as HTMLElement | null | undefined;

  useLayoutEffect(() => {
    const target = connected || (gl.domElement.parentNode as HTMLElement | null);
    if (!target) return;
    const element = document.createElement("div");
    element.style.cssText = "position:absolute;top:0;left:0;display:none;";
    target.appendChild(element);
    const created = createRoot(element);
    holder.current = element;
    root.current = created;
    last.current = { transform: "", zIndex: "", display: "none" };
    return () => {
      holder.current = null;
      root.current = null;
      element.remove();
      // Not mid-render (React warns): the element is already detached, so nothing visible waits on it.
      window.setTimeout(() => created.unmount(), 0);
    };
  }, [gl, connected]);

  useLayoutEffect(() => {
    root.current?.render(<div style={{ position: "absolute", transform: "translate3d(-50%,-50%,0)", ...style }}>{children}</div>);
  });

  useFrame(({ camera, size }) => {
    const element = holder.current;
    if (!element || !group.current) return;
    camera.updateMatrixWorld();
    group.current.getWorldPosition(world);
    toObject.copy(world).sub(camera.position);
    const ahead = toObject.dot(camera.getWorldDirection(facing)) > 0;
    const display = ahead ? "block" : "none";
    if (display !== last.current.display) element.style.display = last.current.display = display;
    if (!ahead) return;
    const perspective = camera as THREE.PerspectiveCamera;
    const depth = Math.min(1, Math.max(0, (toObject.length() - perspective.near) / (perspective.far - perspective.near)));
    const zIndex = String(Math.round(zIndexRange[0] + (zIndexRange[1] - zIndexRange[0]) * depth));
    world.project(camera);
    const transform = `translate3d(${((world.x + 1) * size.width) / 2}px,${((1 - world.y) * size.height) / 2}px,0)`;
    if (transform !== last.current.transform) element.style.transform = last.current.transform = transform;
    if (zIndex !== last.current.zIndex) element.style.zIndex = last.current.zIndex = zIndex;
  });

  return <group ref={group} position={position} />;
}
