import { useRef, useCallback, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds } from '@react-three/drei';
import { Suspense } from 'react';
import { CameraController } from './CameraController';
import type { CameraApi } from './CameraController';
import { BoundsContent } from './BoundsContent';
import { ClusterMarker } from './ClusterMarker';
import { GradeCloud } from './GradeCloud';
import { MapPlane } from './MapPlane';
import {
  useClusters,
  useDrillholes,
  useGradeEstimation,
  useMetadata,
} from '../hooks/useDrillholes';
import { Tooltip } from './Tooltip';
import { HelpPopup } from './HelpPopup';
import { useStore } from '../store/useStore';
import { buildGoogleMapsUrl } from '../utils/googleMaps';

class SceneErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Scene render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full items-center justify-center" data-testid="error">
          <span className="text-red-400">3D rendering failed. Try refreshing the page.</span>
        </div>
      );
    }
    return this.props.children;
  }
}

function GradeCloudLayer() {
  const { data: gradeEstimation } = useGradeEstimation();
  const { data: metadata } = useMetadata();
  const showGradeCloud = useStore((s) => s.showGradeCloud);

  if (!showGradeCloud || !gradeEstimation || !metadata || gradeEstimation.voxels.length === 0) {
    return null;
  }

  return (
    <GradeCloud
      voxels={gradeEstimation.voxels}
      cellSize={gradeEstimation.cell_size}
      gradeMin={metadata.grade_range.min}
      gradeMax={metadata.grade_range.max}
    />
  );
}

function MapLayer() {
  const { data: metadata } = useMetadata();
  const showMap = useStore((s) => s.showMap);

  if (!showMap || !metadata?.scene_bounds) return null;

  return (
    <Suspense fallback={null}>
      <MapPlane bounds={metadata.scene_bounds} />
    </Suspense>
  );
}

function ClusterLayer() {
  const { data: clusters } = useClusters();
  if (!clusters) return null;
  return (
    <>
      {clusters.map((c) => (
        <ClusterMarker key={c.id} cluster={c} />
      ))}
    </>
  );
}

function SceneSetup({ onReady }: { onReady: (api: { resetCamera: () => void }) => void }) {
  const cameraApiRef = useRef<CameraApi | null>(null);

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[100, 200, 100]} intensity={0.4} />
      <CameraController apiRef={cameraApiRef} />
      <Bounds fit clip margin={1.2}>
        <BoundsContent onReady={onReady} cameraApi={cameraApiRef} />
      </Bounds>
      <ClusterLayer />
      <MapLayer />
      <GradeCloudLayer />
    </>
  );
}

export function Scene() {
  const { data: drillholes, isLoading, error } = useDrillholes();
  const { data: metadata } = useMetadata();
  const { data: gradeEstimation } = useGradeEstimation();
  const { data: clusters } = useClusters();
  const setSelectedHole = useStore((s) => s.setSelectedHole);
  const showGradeCloud = useStore((s) => s.showGradeCloud);
  const setShowGradeCloud = useStore((s) => s.setShowGradeCloud);
  const showMap = useStore((s) => s.showMap);
  const setShowMap = useStore((s) => s.setShowMap);
  const sceneApi = useRef<{ resetCamera: () => void } | null>(null);

  const handleMissed = useCallback(() => {
    setSelectedHole(null);
  }, [setSelectedHole]);

  const handleReady = useCallback((api: { resetCamera: () => void }) => {
    sceneApi.current = api;
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center" data-testid="loading">
        <span className="text-text-secondary">Loading drillhole data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center" data-testid="error">
        <span className="text-red-400">Failed to load data. Is the backend running?</span>
      </div>
    );
  }

  if (!drillholes || !metadata) return null;

  return (
    <div className="relative h-full w-full" data-testid="scene">
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, #4a90c4 0%, #0f0d0b 40%, #0f0d0b 60%, #1a1008 100%)',
        }}
      />
      <SceneErrorBoundary>
        <Canvas
          camera={{ position: [200, 200, 200], fov: 50, near: 0.1, far: 10000 }}
          style={{ background: 'transparent' }}
          onPointerMissed={handleMissed}
        >
          <SceneSetup onReady={handleReady} />
        </Canvas>
      </SceneErrorBoundary>
      <div className="absolute right-3 top-3 flex flex-col gap-1.5">
        <Tooltip text="Reset camera to fit all holes">
          <button
            onClick={() => sceneApi.current?.resetCamera()}
            className="rounded bg-bg-raised px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:bg-bg-surface hover:text-text-primary"
          >
            Fit all
          </button>
        </Tooltip>
        {gradeEstimation && gradeEstimation.voxels.length > 0 && (
          <Tooltip text="Toggle estimated grade cloud (visual aid only)">
            <button
              onClick={() => setShowGradeCloud(!showGradeCloud)}
              className={`rounded px-2.5 py-1.5 text-xs transition-colors ${
                showGradeCloud
                  ? 'bg-amber-900/60 text-amber-200'
                  : 'bg-bg-raised text-text-secondary hover:bg-bg-surface hover:text-text-primary'
              }`}
            >
              {showGradeCloud ? 'Hide grades' : 'Show grades'}
            </button>
          </Tooltip>
        )}
        <Tooltip text="Toggle satellite map and ground plane">
          <button
            onClick={() => setShowMap(!showMap)}
            className={`rounded px-2.5 py-1.5 text-xs transition-colors ${
              showMap
                ? 'bg-emerald-900/60 text-emerald-200'
                : 'bg-bg-raised text-text-secondary hover:bg-bg-surface hover:text-text-primary'
            }`}
          >
            {showMap ? 'Hide map' : 'Show map'}
          </button>
        </Tooltip>
        <Tooltip text="Open project area in Google Maps (satellite view)">
          <a
            href={clusters ? buildGoogleMapsUrl(clusters) : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded bg-bg-raised px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:bg-bg-surface hover:text-text-primary"
          >
            Google Maps
          </a>
        </Tooltip>
        <HelpPopup />
      </div>
      {showGradeCloud && gradeEstimation && (
        <div className="absolute bottom-3 right-3 max-w-56 rounded bg-bg-raised/90 px-2.5 py-1.5 text-[10px] leading-tight text-text-muted">
          {gradeEstimation.disclaimer}
        </div>
      )}
    </div>
  );
}
