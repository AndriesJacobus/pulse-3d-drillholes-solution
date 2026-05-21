import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Vector3 } from 'three';
import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useStore } from '../store/useStore';
import type { Intercept } from '../types/drillhole';

interface InterceptSegmentProps {
  intercept: Intercept;
  colour: string;
  isParentSelected: boolean;
}

const BASE_HIT_RADIUS = 2;
const CLOSE_DISTANCE = 50;
const FAR_DISTANCE = 1000;
const MAX_SCALE = 6;

export function InterceptSegment({ intercept, colour, isParentSelected }: InterceptSegmentProps) {
  const setSelectedIntercept = useStore((s) => s.setSelectedIntercept);
  const hitMeshRef = useRef<THREE.Mesh>(null);

  const points = useMemo(
    () => [
      new Vector3(intercept.start_pos.x, intercept.start_pos.y, intercept.start_pos.z),
      new Vector3(intercept.end_pos.x, intercept.end_pos.y, intercept.end_pos.z),
    ],
    [intercept.start_pos, intercept.end_pos],
  );

  const hitMesh = useMemo(() => {
    const start = points[0];
    const end = points[1];
    const mid = new Vector3().addVectors(start, end).multiplyScalar(0.5);
    const length = start.distanceTo(end);
    const direction = new Vector3().subVectors(end, start).normalize();
    const up = new Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction);
    return { mid, length, quaternion };
  }, [points]);

  useFrame(({ camera }) => {
    if (!hitMeshRef.current) return;
    const dist = camera.position.distanceTo(hitMesh.mid);
    const t = Math.min(1, Math.max(0, (dist - CLOSE_DISTANCE) / (FAR_DISTANCE - CLOSE_DISTANCE)));
    const scale = 1 + t * (MAX_SCALE - 1);
    hitMeshRef.current.scale.set(scale, 1, scale);
  });

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setSelectedIntercept(intercept);
  };

  return (
    <group>
      <Line points={points} color={colour} lineWidth={isParentSelected ? 5 : 4} />
      <mesh
        ref={hitMeshRef}
        position={hitMesh.mid}
        quaternion={hitMesh.quaternion}
        onClick={handleClick}
      >
        <cylinderGeometry args={[BASE_HIT_RADIUS, BASE_HIT_RADIUS, hitMesh.length, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
