import { useMemo } from 'react';
import { DrillholeTrace } from './DrillholeTrace';
import { createGradeColourScale } from '../utils/colourScale';
import type { Drillhole, Metadata } from '../types/drillhole';

interface DrillholeGroupProps {
  drillholes: Drillhole[];
  metadata: Metadata;
}

export function DrillholeGroup({ drillholes, metadata }: DrillholeGroupProps) {
  const colourScale = useMemo(
    () => createGradeColourScale(metadata.grade_range.min, metadata.grade_range.max),
    [metadata.grade_range.min, metadata.grade_range.max],
  );

  return (
    <group>
      {drillholes.map((hole) => (
        <DrillholeTrace key={hole.hole_code} hole={hole} colourScale={colourScale} />
      ))}
    </group>
  );
}
