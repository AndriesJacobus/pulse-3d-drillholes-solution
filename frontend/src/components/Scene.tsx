import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { Bounds, OrbitControls, useBounds } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Suspense } from 'react';
import { ClusterMarker } from './ClusterMarker';
import { DrillholeGroup } from './DrillholeGroup';
import { GradeCloud } from './GradeCloud';
import { MapPlane } from './MapPlane';
import {
  useClusters,
  useDrillholes,
  useGradeEstimation,
  useMetadata,
} from '../hooks/useDrillholes';
import { Tooltip } from './Tooltip';
import { useStore } from '../store/useStore';

const ANIM_DURATION_S = 1.0;
const HOLE_ZOOM_DISTANCE = 350;

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

type AnimateFn = (
  target: THREE.Vector3,
  camDest: THREE.Vector3 | null,
  dur?: number,
  onComplete?: () => void,
) => void;

interface CameraApi {
  animate: AnimateFn;
  stop: () => void;
}

function CameraController({ apiRef }: { apiRef: React.RefObject<CameraApi | null> }) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const selectedHole = useStore((s) => s.selectedHole);
  const setPdfPage = useStore((s) => s.setPdfPage);
  const focusTarget = useStore((s) => s.focusTarget);
  const setFocusTarget = useStore((s) => s.setFocusTarget);

  const startTarget = useRef(new THREE.Vector3());
  const endTarget = useRef(new THREE.Vector3());
  const startCamPos = useRef(new THREE.Vector3());
  const endCamPos = useRef(new THREE.Vector3());
  const progress = useRef(1);
  const duration = useRef(ANIM_DURATION_S);
  const hasCamDest = useRef(false);
  const onCompleteRef = useRef<(() => void) | null>(null);

  const beginAnimation = useCallback(
    (target: THREE.Vector3, camDest: THREE.Vector3 | null, dur?: number, onComplete?: () => void) => {
      if (!controlsRef.current) return;
      startTarget.current.copy(controlsRef.current.target);
      endTarget.current.copy(target);
      duration.current = dur ?? ANIM_DURATION_S;
      if (camDest) {
        startCamPos.current.copy(controlsRef.current.object.position);
        endCamPos.current.copy(camDest);
        hasCamDest.current = true;
      } else {
        hasCamDest.current = false;
      }
      onCompleteRef.current = onComplete ?? null;
      progress.current = 0;
    },
    [],
  );

  useEffect(() => {
    apiRef.current = {
      animate: beginAnimation,
      stop: () => {
        progress.current = 1;
        onCompleteRef.current = null;
      },
    };
  }, [apiRef, beginAnimation]);

  useEffect(() => {
    if (!selectedHole || !controlsRef.current) return;
    const collar = new THREE.Vector3(
      selectedHole.collar.x,
      selectedHole.collar.y,
      selectedHole.collar.z,
    );
    const camPos = controlsRef.current.object.position;
    const dir = camPos.clone().sub(controlsRef.current.target).normalize();
    const dest = collar.clone().add(dir.multiplyScalar(HOLE_ZOOM_DISTANCE));
    const page = selectedHole.collar_page ?? null;
    beginAnimation(collar, dest, undefined, () => setPdfPage(page));
  }, [selectedHole, beginAnimation, setPdfPage]);

  useEffect(() => {
    if (!focusTarget || !controlsRef.current) return;
    const offset = new THREE.Vector3(1, 0.8, 1).normalize().multiplyScalar(focusTarget.radius * 4);
    const dest = focusTarget.position.clone().add(offset);
    beginAnimation(focusTarget.position, dest, undefined, focusTarget.onArrive);
    setFocusTarget(null);
  }, [focusTarget, setFocusTarget, beginAnimation]);

  useFrame((_state, delta) => {
    if (!controlsRef.current || progress.current >= 1) return;

    progress.current = Math.min(1, progress.current + delta / duration.current);
    const t = smoothstep(progress.current);

    const controls = controlsRef.current;
    controls.target.lerpVectors(startTarget.current, endTarget.current, t);

    if (hasCamDest.current) {
      controls.object.position.lerpVectors(startCamPos.current, endCamPos.current, t);
    }

    controls.update();

    if (progress.current >= 1 && onCompleteRef.current) {
      const cb = onCompleteRef.current;
      onCompleteRef.current = null;
      cb();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.1}
      minDistance={10}
      maxDistance={10000}
    />
  );
}

function BoundsContent({
  onReady,
  cameraApi,
}: {
  onReady: (api: { resetCamera: () => void }) => void;
  cameraApi: React.RefObject<CameraApi | null>;
}) {
  const bounds = useBounds();
  const homeCamPos = useRef<THREE.Vector3 | null>(null);
  const homeTarget = useRef<THREE.Vector3 | null>(null);
  const captureCountdown = useRef(-1);

  useEffect(() => {
    onReady({
      resetCamera: () => {
        if (homeCamPos.current && homeTarget.current) {
          cameraApi.current?.animate(homeTarget.current, homeCamPos.current, ANIM_DURATION_S);
        } else {
          bounds.refresh().fit();
        }
      },
    });
  }, [bounds, onReady, cameraApi]);

  const { data: drillholes } = useDrillholes();
  const { data: metadata } = useMetadata();

  useEffect(() => {
    if (!drillholes || !metadata) return;
    captureCountdown.current = 90;
  }, [drillholes, metadata]);

  useFrame(({ camera }) => {
    if (captureCountdown.current <= 0) return;
    captureCountdown.current--;
    if (captureCountdown.current === 0) {
      homeCamPos.current = camera.position.clone();
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      homeTarget.current = camera.position.clone().add(dir.multiplyScalar(500));
    }
  });

  if (!drillholes || !metadata) return null;

  return <DrillholeGroup drillholes={drillholes} metadata={metadata} />;
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

function buildGoogleMapsUrl(points: { latitude: number; longitude: number }[]): string {
  if (points.length === 0) return 'https://www.google.com/maps';
  const stops = points.map((p) => `${p.latitude},${p.longitude}`).join('/');
  const lats = points.map((p) => p.latitude);
  const lons = points.map((p) => p.longitude);
  const centLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const centLon = (Math.min(...lons) + Math.max(...lons)) / 2;
  return `https://www.google.com/maps/dir/${stops}/@${centLat},${centLon},15z/data=!4m2!4m1!3e2`;
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
    <div className="relative h-full w-full">
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, #4a90c4 0%, #0f0d0b 40%, #0f0d0b 60%, #1a1008 100%)',
        }}
      />
      <Canvas
        camera={{ position: [200, 200, 200], fov: 50, near: 0.1, far: 10000 }}
        style={{ background: 'transparent' }}
        onPointerMissed={handleMissed}
      >
        <SceneSetup onReady={handleReady} />
      </Canvas>
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
      </div>
      {showGradeCloud && gradeEstimation && (
        <div className="absolute bottom-3 right-3 max-w-56 rounded bg-bg-raised/90 px-2.5 py-1.5 text-[10px] leading-tight text-text-muted">
          {gradeEstimation.disclaimer}
        </div>
      )}
    </div>
  );
}
