import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Vector3 } from 'three';
import { Line, Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { InterceptSegment } from './InterceptSegment';
import { gradeToColour } from '../utils/colourScale';
import { useStore } from '../store/useStore';
import type { Drillhole } from '../types/drillhole';
import type { createGradeColourScale } from '../utils/colourScale';

interface DrillholeTraceProps {
  hole: Drillhole;
  colourScale: ReturnType<typeof createGradeColourScale>;
}

const BASE_HIT_RADIUS = 1.5;
const CLOSE_DISTANCE = 50;
const FAR_DISTANCE = 1000;
const MAX_SCALE = 6;

export function DrillholeTrace({ hole, colourScale }: DrillholeTraceProps) {
  const selectedHole = useStore((s) => s.selectedHole);
  const setSelectedHole = useStore((s) => s.setSelectedHole);
  const [hovered, setHovered] = useState(false);
  const hitMeshRef = useRef<THREE.Mesh>(null);
  const collarVec = useMemo(
    () => new Vector3(hole.collar.x, hole.collar.y, hole.collar.z),
    [hole.collar],
  );

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

  useFrame(({ camera }) => {
    if (!hitMeshRef.current) return;
    const dist = camera.position.distanceTo(collarVec);
    const t = Math.min(1, Math.max(0, (dist - CLOSE_DISTANCE) / (FAR_DISTANCE - CLOSE_DISTANCE)));
    const scale = 1 + t * (MAX_SCALE - 1);
    hitMeshRef.current.scale.set(scale, 1, scale);
  });

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setSelectedHole(hole);
  };

  if (tracePoints.length < 2) return null;

  return (
    <group>
      <Line
        points={tracePoints}
        color={isSelected ? '#ffffff' : hovered ? '#cccccc' : '#666666'}
        lineWidth={isSelected ? 2.5 : hovered ? 2 : 1.5}
      />

      <mesh
        ref={hitMeshRef}
        position={traceHitMesh.mid}
        quaternion={traceHitMesh.quaternion}
        onClick={handleClick}
        onPointerEnter={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerLeave={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <cylinderGeometry args={[BASE_HIT_RADIUS, BASE_HIT_RADIUS, traceHitMesh.length, 6]} />
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

      <mesh position={collarPos} onClick={handleClick}>
        <sphereGeometry args={[2, 8, 8]} />
        <meshStandardMaterial color={isSelected ? '#ffc53d' : '#a8a29e'} />
      </mesh>

      <Html position={collarPos} center style={{ pointerEvents: 'auto', cursor: 'pointer' }}>
        <span
          data-testid="collar-label"
          className={`whitespace-nowrap rounded px-1 py-0.5 font-mono text-[9px] hover:bg-amber-500/80 hover:text-black ${
            isSelected ? 'bg-accent/90 text-bg-base font-medium' : 'bg-black/70 text-text-secondary'
          }`}
          onClick={handleClick}
        >
          {hole.hole_code}
        </span>
      </Html>
    </group>
  );
}
