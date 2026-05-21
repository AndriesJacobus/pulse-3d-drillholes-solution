export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Intercept {
  depth_from: number;
  depth_to: number;
  interval_m: number;
  grade: number;
  grade_unit: string;
  commodity: string;
  start_pos: Point3D;
  end_pos: Point3D;
  page: number | null;
}

export interface Drillhole {
  hole_code: string;
  prospect: string;
  collar: Point3D;
  trace: Point3D[];
  total_depth: number;
  dip: number;
  azimuth: number;
  latitude: number;
  longitude: number;
  collar_page: number | null;
  intercepts: Intercept[];
}

export interface GeoCentroid {
  east: number;
  north: number;
  rl: number;
}

export interface SceneBounds {
  min_x: number;
  max_x: number;
  min_y: number;
  max_y: number;
  min_z: number;
  max_z: number;
}

export interface Metadata {
  project_name: string;
  prospects: string[];
  total_holes: number;
  total_intercepts: number;
  grade_range: { min: number; max: number };
  centroid: GeoCentroid;
  commodities: string[];
  scene_bounds: SceneBounds | null;
}

export interface Cluster {
  id: number;
  label: string;
  prospect: string;
  centroid: Point3D;
  radius: number;
  hole_codes: string[];
  latitude: number;
  longitude: number;
}

export interface GradeVoxel {
  x: number;
  y: number;
  z: number;
  grade: number;
  uncertainty: number;
  opacity: number;
}

export interface GradeEstimation {
  voxels: GradeVoxel[];
  cell_size: number;
  method: string;
  sample_count: number;
  disclaimer: string;
}
