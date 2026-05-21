import { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { createGradeColourScale, gradeToColour, parseColourToRgb } from '../utils/colourScale';
import type { GradeVoxel } from '../types/drillhole';

interface GradeCloudProps {
  voxels: GradeVoxel[];
  cellSize: number;
  gradeMin: number;
  gradeMax: number;
}

const dummy = new THREE.Object3D();
const colour = new THREE.Color();

export function GradeCloud({ voxels, cellSize, gradeMin, gradeMax }: GradeCloudProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const colourScale = useMemo(
    () => createGradeColourScale(gradeMin, gradeMax),
    [gradeMin, gradeMax],
  );

  useEffect(() => {
    if (!meshRef.current || voxels.length === 0) return;
    const mesh = meshRef.current;

    for (let i = 0; i < voxels.length; i++) {
      const v = voxels[i];
      dummy.position.set(v.x, v.y, v.z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      const rgb = parseColourToRgb(gradeToColour(colourScale, v.grade));
      colour.setRGB(rgb[0], rgb[1], rgb[2]);
      mesh.setColorAt(i, colour);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [voxels, colourScale]);

  if (voxels.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, voxels.length]} renderOrder={-1}>
      <boxGeometry args={[cellSize * 0.9, cellSize * 0.9, cellSize * 0.9]} />
      <meshStandardMaterial transparent opacity={0.35} depthWrite={false} />
    </instancedMesh>
  );
}
