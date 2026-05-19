import { useMemo } from 'react';
import * as THREE from 'three';
import { Vector3 } from 'three';
import { Line, Html } from '@react-three/drei';
import { InterceptSegment } from './InterceptSegment';
import { gradeToColour } from '../utils/colourScale';
import { useStore } from '../store/useStore';
import type { Drillhole } from '../types/drillhole';
import type { createGradeColourScale } from '../utils/colourScale';

interface DrillholeTraceProps {
  hole: Drillhole;
  colourScale: ReturnType<typeof createGradeColourScale>;
}

const HIT_RADIUS = 1.5;

export function DrillholeTrace({ hole, colourScale }: DrillholeTraceProps) {
  const selectedHole = useStore((s) => s.selectedHole);
  const setSelectedHole = useStore((s) => s.setSelectedHole);

  const isSelected = selectedHole?.hole_code === hole.hole_code;

  const tracePoints = useMemo(
    () => hole.trace.map((p) => new Vector3(p.x, p.y, p.z)),
    [hole.trace],
  );

  const collarPos = useMemo<[number, number, number]>(
    () => [hole.collar.x, hole.collar.y, hole.collar.z],
    [hole.collar],
  );

  const traceHitMesh = useMemo(() => {
    const start = tracePoints[0];
    const end = tracePoints[tracePoints.length - 1];
    const mid = new Vector3().addVectors(start, end).multiplyScalar(0.5);
    const length = start.distanceTo(end);
    const direction = new Vector3().subVectors(end, start).normalize();
    const up = new Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction);
    return { mid, length, quaternion };
  }, [tracePoints]);

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setSelectedHole(hole);
  };

  if (tracePoints.length < 2) return null;

  return (
    <group>
      <Line
        points={tracePoints}
        color={isSelected ? '#ffffff' : '#666666'}
        lineWidth={isSelected ? 2.5 : 1.5}
      />

      <mesh position={traceHitMesh.mid} quaternion={traceHitMesh.quaternion} onClick={handleClick}>
        <cylinderGeometry args={[HIT_RADIUS, HIT_RADIUS, traceHitMesh.length, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {hole.intercepts.map((intercept, i) => (
        <InterceptSegment
          key={i}
          intercept={intercept}
          colour={gradeToColour(colourScale, intercept.grade)}
          isParentSelected={isSelected}
        />
      ))}

      <mesh position={collarPos}>
        <sphereGeometry args={[2, 8, 8]} />
        <meshStandardMaterial color={isSelected ? '#ffc53d' : '#a8a29e'} />
      </mesh>

      <Html position={collarPos} distanceFactor={300} center style={{ pointerEvents: 'none' }}>
        <span
          className={`whitespace-nowrap rounded px-1 py-0.5 font-mono text-[10px] ${
            isSelected ? 'bg-accent/90 text-bg-base font-medium' : 'bg-black/70 text-text-secondary'
          }`}
        >
          {hole.hole_code}
        </span>
      </Html>
    </group>
  );
}
