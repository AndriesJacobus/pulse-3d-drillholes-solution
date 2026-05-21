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

  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      transparent: true,
      depthWrite: false,
    });
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          'void main() {',
          'attribute float instanceOpacity;\nvarying float vInstanceOpacity;\nvoid main() {',
        )
        .replace(
          '#include <color_vertex>',
          '#include <color_vertex>\nvInstanceOpacity = instanceOpacity;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'varying float vInstanceOpacity;\nvoid main() {')
        .replace(
          '#include <opaque_fragment>',
          'diffuseColor.a *= vInstanceOpacity;\n#include <opaque_fragment>',
        );
    };
    return mat;
  }, []);

  useEffect(() => {
    if (!meshRef.current || voxels.length === 0) return;
    const mesh = meshRef.current;

    const opacities = new Float32Array(voxels.length);

    for (let i = 0; i < voxels.length; i++) {
      const v = voxels[i];
      dummy.position.set(v.x, v.y, v.z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      const rgb = parseColourToRgb(gradeToColour(colourScale, v.grade));
      colour.setRGB(rgb[0], rgb[1], rgb[2]);
      mesh.setColorAt(i, colour);

      opacities[i] = v.opacity;
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    const attr = new THREE.InstancedBufferAttribute(opacities, 1);
    mesh.geometry.setAttribute('instanceOpacity', attr);
  }, [voxels, colourScale]);

  if (voxels.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, voxels.length]} renderOrder={-1}>
      <boxGeometry args={[cellSize * 0.9, cellSize * 0.9, cellSize * 0.9]} />
      <primitive object={material} attach="material" />
    </instancedMesh>
  );
}
