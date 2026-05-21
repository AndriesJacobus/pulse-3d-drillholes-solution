import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useBounds } from '@react-three/drei';
import { DrillholeGroup } from './DrillholeGroup';
import { useDrillholes, useMetadata } from '../hooks/useDrillholes';
import type { CameraApi } from './CameraController';
import { ANIM_DURATION_S } from './CameraController';

const VELOCITY_THRESHOLD = 0.05;
const MIN_SETTLE_FRAMES = 30;

export function BoundsContent({
  onReady,
  cameraApi,
}: {
  onReady: (api: { resetCamera: () => void }) => void;
  cameraApi: React.RefObject<CameraApi | null>;
}) {
  const bounds = useBounds();
  const homeCamPos = useRef<THREE.Vector3 | null>(null);
  const homeTarget = useRef<THREE.Vector3 | null>(null);
  const prevCamPos = useRef<THREE.Vector3 | null>(null);
  const settleFrames = useRef(0);
  const capturing = useRef(false);

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
    capturing.current = true;
    settleFrames.current = 0;
    prevCamPos.current = null;
  }, [drillholes, metadata]);

  useFrame(({ camera }) => {
    if (!capturing.current) return;

    const pos = camera.position;
    if (prevCamPos.current) {
      const velocity = pos.distanceTo(prevCamPos.current);
      if (velocity < VELOCITY_THRESHOLD) {
        settleFrames.current++;
      } else {
        settleFrames.current = 0;
      }

      if (settleFrames.current >= MIN_SETTLE_FRAMES) {
        homeCamPos.current = pos.clone();
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        homeTarget.current = pos.clone().add(dir.multiplyScalar(500));
        capturing.current = false;
      }
    }
    prevCamPos.current = pos.clone();
  });

  if (!drillholes || !metadata) return null;

  return <DrillholeGroup drillholes={drillholes} metadata={metadata} />;
}
