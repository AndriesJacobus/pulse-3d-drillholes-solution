import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useStore } from '../store/useStore';

export const ANIM_DURATION_S = 1.0;
const HOLE_ZOOM_DISTANCE_MIN = 150;
const HOLE_ZOOM_DISTANCE_MAX = 500;

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

export type AnimateFn = (
  target: THREE.Vector3,
  camDest: THREE.Vector3 | null,
  dur?: number,
  onComplete?: () => void,
) => void;

export interface CameraApi {
  animate: AnimateFn;
  stop: () => void;
}

function traceExtent(trace: { x: number; y: number; z: number }[]): number {
  if (trace.length < 2) return 100;
  const first = trace[0];
  const last = trace[trace.length - 1];
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const dz = last.z - first.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function CameraController({ apiRef }: { apiRef: React.RefObject<CameraApi | null> }) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const selectedHole = useStore((s) => s.selectedHole);
  const setPdfPage = useStore((s) => s.setPdfPage);
  const focusTarget = useStore((s) => s.focusTarget);
  const setFocusTarget = useStore((s) => s.setFocusTarget);

  const startTarget = useRef(new THREE.Vector3());
  const endTarget = useRef(new THREE.Vector3());
  const startCamPos = useRef(new THREE.Vector3());
  const endCamPos = useRef(new THREE.Vector3());
  const progress = useRef(1);
  const duration = useRef(ANIM_DURATION_S);
  const hasCamDest = useRef(false);
  const onCompleteRef = useRef<(() => void) | null>(null);

  const beginAnimation = useCallback(
    (
      target: THREE.Vector3,
      camDest: THREE.Vector3 | null,
      dur?: number,
      onComplete?: () => void,
    ) => {
      if (!controlsRef.current) return;
      startTarget.current.copy(controlsRef.current.target);
      endTarget.current.copy(target);
      duration.current = dur ?? ANIM_DURATION_S;
      if (camDest) {
        startCamPos.current.copy(controlsRef.current.object.position);
        endCamPos.current.copy(camDest);
        hasCamDest.current = true;
      } else {
        hasCamDest.current = false;
      }
      onCompleteRef.current = onComplete ?? null;
      progress.current = 0;
    },
    [],
  );

  useEffect(() => {
    apiRef.current = {
      animate: beginAnimation,
      stop: () => {
        progress.current = 1;
        onCompleteRef.current = null;
      },
    };
  }, [apiRef, beginAnimation]);

  useEffect(() => {
    if (!selectedHole || !controlsRef.current) return;
    const collar = new THREE.Vector3(
      selectedHole.collar.x,
      selectedHole.collar.y,
      selectedHole.collar.z,
    );
    const extent = traceExtent(selectedHole.trace);
    const zoomDist = Math.min(
      HOLE_ZOOM_DISTANCE_MAX,
      Math.max(HOLE_ZOOM_DISTANCE_MIN, extent * 2.5),
    );
    const camPos = controlsRef.current.object.position;
    const dir = camPos.clone().sub(controlsRef.current.target).normalize();
    const dest = collar.clone().add(dir.multiplyScalar(zoomDist));
    const page = selectedHole.collar_page ?? null;
    beginAnimation(collar, dest, undefined, () => setPdfPage(page));
  }, [selectedHole, beginAnimation, setPdfPage]);

  useEffect(() => {
    if (!focusTarget || !controlsRef.current) return;
    const offset = new THREE.Vector3(1, 0.8, 1).normalize().multiplyScalar(focusTarget.radius * 4);
    const dest = focusTarget.position.clone().add(offset);
    beginAnimation(focusTarget.position, dest, undefined, focusTarget.onArrive);
    setFocusTarget(null);
  }, [focusTarget, setFocusTarget, beginAnimation]);

  useFrame((_state, delta) => {
    if (!controlsRef.current || progress.current >= 1) return;

    progress.current = Math.min(1, progress.current + delta / duration.current);
    const t = smoothstep(progress.current);

    const controls = controlsRef.current;
    controls.target.lerpVectors(startTarget.current, endTarget.current, t);

    if (hasCamDest.current) {
      controls.object.position.lerpVectors(startCamPos.current, endCamPos.current, t);
    }

    controls.update();

    if (progress.current >= 1 && onCompleteRef.current) {
      const cb = onCompleteRef.current;
      onCompleteRef.current = null;
      cb();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.1}
      minDistance={10}
      maxDistance={10000}
    />
  );
}
