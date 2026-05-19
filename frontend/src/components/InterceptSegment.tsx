import { useMemo } from 'react';
import { Vector3 } from 'three';
import { Line } from '@react-three/drei';
import { useStore } from '../store/useStore';
import type { Intercept } from '../types/drillhole';

interface InterceptSegmentProps {
  intercept: Intercept;
  colour: string;
  isParentSelected: boolean;
}

export function InterceptSegment({ intercept, colour, isParentSelected }: InterceptSegmentProps) {
  const setSelectedIntercept = useStore((s) => s.setSelectedIntercept);

  const points = useMemo(
    () => [
      new Vector3(intercept.start_pos.x, intercept.start_pos.y, intercept.start_pos.z),
      new Vector3(intercept.end_pos.x, intercept.end_pos.y, intercept.end_pos.z),
    ],
    [intercept.start_pos, intercept.end_pos],
  );

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setSelectedIntercept(intercept);
  };

  return (
    <Line
      points={points}
      color={colour}
      lineWidth={isParentSelected ? 5 : 4}
      onClick={handleClick}
    />
  );
}
