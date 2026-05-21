import { useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneBounds } from '../types/drillhole';

interface MapPlaneProps {
  bounds: SceneBounds;
}

const CENTROID_LAT = -29.949188;
const CENTROID_LON = 121.166532;
const METRES_PER_DEGREE_LAT = 111320;
const METRES_PER_DEGREE_LON = 111320 * Math.cos((CENTROID_LAT * Math.PI) / 180);

const TILE_PADDING_M = 200;
const MAX_TILE_COUNT = 12;
const SURFACE_OFFSET = 15;

function latLonToTile(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

function tileBoundsLatLon(tx: number, ty: number, zoom: number) {
  const n = 2 ** zoom;
  const west = (tx / n) * 360 - 180;
  const east = ((tx + 1) / n) * 360 - 180;
  const northRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * ty) / n)));
  const southRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (ty + 1)) / n)));
  return {
    north: (northRad * 180) / Math.PI,
    south: (southRad * 180) / Math.PI,
    west,
    east,
  };
}

function latLonToScene(lat: number, lon: number): { x: number; z: number } {
  return {
    x: (lon - CENTROID_LON) * METRES_PER_DEGREE_LON,
    z: -((lat - CENTROID_LAT) * METRES_PER_DEGREE_LAT),
  };
}

interface TileSpec {
  tx: number;
  ty: number;
  zoom: number;
  centreX: number;
  centreZ: number;
  width: number;
  depth: number;
}

function computeTileGrid(bounds: SceneBounds): TileSpec[] {
  const latNorth = CENTROID_LAT + -(bounds.min_z - TILE_PADDING_M) / METRES_PER_DEGREE_LAT;
  const latSouth = CENTROID_LAT + -(bounds.max_z + TILE_PADDING_M) / METRES_PER_DEGREE_LAT;
  const lonWest = CENTROID_LON + (bounds.min_x - TILE_PADDING_M) / METRES_PER_DEGREE_LON;
  const lonEast = CENTROID_LON + (bounds.max_x + TILE_PADDING_M) / METRES_PER_DEGREE_LON;

  let zoom = 15;
  for (let z = 15; z >= 10; z--) {
    const nwTile = latLonToTile(latNorth, lonWest, z);
    const seTile = latLonToTile(latSouth, lonEast, z);
    const count = (seTile.x - nwTile.x + 1) * (seTile.y - nwTile.y + 1);
    if (count <= MAX_TILE_COUNT) {
      zoom = z;
      break;
    }
  }

  const nwTile = latLonToTile(latNorth, lonWest, zoom);
  const seTile = latLonToTile(latSouth, lonEast, zoom);

  const tiles: TileSpec[] = [];
  for (let tx = nwTile.x; tx <= seTile.x; tx++) {
    for (let ty = nwTile.y; ty <= seTile.y; ty++) {
      const tb = tileBoundsLatLon(tx, ty, zoom);
      const nw = latLonToScene(tb.north, tb.west);
      const se = latLonToScene(tb.south, tb.east);

      tiles.push({
        tx,
        ty,
        zoom,
        centreX: (nw.x + se.x) / 2,
        centreZ: (nw.z + se.z) / 2,
        width: Math.abs(se.x - nw.x),
        depth: Math.abs(nw.z - se.z),
      });
    }
  }

  return tiles;
}

function Tile({ spec, yPos }: { spec: TileSpec; yPos: number }) {
  const url =
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile` +
    `/${spec.zoom}/${spec.ty}/${spec.tx}`;
  const texture = useLoader(THREE.TextureLoader, url);

  return (
    <mesh
      position={[spec.centreX, yPos, spec.centreZ]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={-2}
      raycast={() => null}
    >
      <planeGeometry args={[spec.width, spec.depth]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.7}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

const GROUND_SIZE = 20000;
const GROUND_COLOUR = '#2a1f10';

export function MapPlane({ bounds }: MapPlaneProps) {
  const tiles = useMemo(() => computeTileGrid(bounds), [bounds]);

  const yPos = bounds.max_y - SURFACE_OFFSET;

  return (
    <>
      <mesh
        position={[0, yPos - 0.1, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={-3}
        raycast={() => null}
      >
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
        <meshBasicMaterial
          color={GROUND_COLOUR}
          transparent
          opacity={0.5}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {tiles.map((spec) => (
        <Tile key={`${spec.tx}-${spec.ty}`} spec={spec} yPos={yPos} />
      ))}
    </>
  );
}
