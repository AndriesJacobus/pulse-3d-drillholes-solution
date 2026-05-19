import { Canvas } from '@react-three/fiber';
import { Bounds, OrbitControls } from '@react-three/drei';
import { DrillholeGroup } from './DrillholeGroup';
import { useDrillholes, useMetadata } from '../hooks/useDrillholes';

export function Scene() {
  const { data: drillholes, isLoading, error } = useDrillholes();
  const { data: metadata } = useMetadata();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-text-secondary">Loading drillhole data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-red-400">Failed to load data. Is the backend running?</span>
      </div>
    );
  }

  if (!drillholes || !metadata) return null;

  return (
    <Canvas
      camera={{ position: [200, 200, 200], fov: 50, near: 0.1, far: 10000 }}
      style={{ background: '#0F0D0B' }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[100, 200, 100]} intensity={0.4} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.1}
        minDistance={10}
        maxDistance={2000}
      />
      <Bounds fit clip observe margin={1.2}>
        <DrillholeGroup drillholes={drillholes} metadata={metadata} />
      </Bounds>
    </Canvas>
  );
}
