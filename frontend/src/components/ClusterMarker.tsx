import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { Cluster } from '../types/drillhole';
import { useStore } from '../store/useStore';

const LABEL_SHOW_DISTANCE = 600;

interface ClusterMarkerProps {
  cluster: Cluster;
}

export function ClusterMarker({ cluster }: ClusterMarkerProps) {
  const setFocusTarget = useStore((s) => s.setFocusTarget);
  const setPdfPage = useStore((s) => s.setPdfPage);
  const [labelVisible, setLabelVisible] = useState(true);
  const groupRef = useRef<THREE.Group>(null);

  const ringRadius = Math.max(cluster.radius, 40);

  const discY = cluster.centroid.y + 5;

  const position = useMemo<[number, number, number]>(
    () => [cluster.centroid.x, discY, cluster.centroid.z],
    [cluster.centroid, discY],
  );

  useFrame(({ camera }) => {
    const dist = camera.position.distanceTo(
      new THREE.Vector3(position[0], position[1], position[2]),
    );
    const shouldShow = dist > LABEL_SHOW_DISTANCE;
    if (shouldShow !== labelVisible) setLabelVisible(shouldShow);
  });

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setFocusTarget({
      position: new THREE.Vector3(cluster.centroid.x, cluster.centroid.y, cluster.centroid.z),
      radius: ringRadius,
      onArrive: () => setPdfPage(null),
    });
  };

  return (
    <group ref={groupRef}>
      <mesh
        position={position}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={1}
        raycast={() => null}
      >
        <circleGeometry args={[ringRadius, 64]} />
        <meshBasicMaterial
          color="#ffc53d"
          transparent
          opacity={0.15}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh
        position={position}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={2}
        raycast={() => null}
      >
        <ringGeometry args={[ringRadius * 0.85, ringRadius, 64]} />
        <meshBasicMaterial
          color="#ffc53d"
          transparent
          opacity={0.7}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {labelVisible && (
        <Html
          position={[position[0], position[1] + 15, position[2]]}
          center
          style={{ pointerEvents: 'auto', cursor: 'pointer' }}
        >
          <span
            className="whitespace-nowrap rounded bg-amber-500/90 px-2.5 py-1 text-xs font-bold text-black shadow-lg hover:bg-amber-400"
            onClick={handleClick}
          >
            {cluster.label}
          </span>
        </Html>
      )}
    </group>
  );
}
