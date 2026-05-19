import { useMemo } from 'react';
import * as THREE from 'three';
import { Vector3 } from 'three';
import { Line } from '@react-three/drei';
import { useStore } from '../store/useStore';
import type { Intercept } from '../types/drillhole';

interface InterceptSegmentProps {
  intercept: Intercept;
  colour: string;
  isParentSelected: boolean;
}

const HIT_RADIUS = 2;

export function InterceptSegment({ intercept, colour, isParentSelected }: InterceptSegmentProps) {
  const setSelectedIntercept = useStore((s) => s.setSelectedIntercept);

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

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setSelectedIntercept(intercept);
  };

  return (
    <group>
      <Line points={points} color={colour} lineWidth={isParentSelected ? 5 : 4} />
      <mesh position={hitMesh.mid} quaternion={hitMesh.quaternion} onClick={handleClick}>
        <cylinderGeometry args={[HIT_RADIUS, HIT_RADIUS, hitMesh.length, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
