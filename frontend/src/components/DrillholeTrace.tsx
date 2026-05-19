import { useMemo } from 'react';
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

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setSelectedHole(hole);
  };

  if (tracePoints.length < 2) return null;

  return (
    <group onClick={handleClick}>
      <Line
        points={tracePoints}
        color={isSelected ? '#ffffff' : '#666666'}
        lineWidth={isSelected ? 2.5 : 1.5}
      />

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
