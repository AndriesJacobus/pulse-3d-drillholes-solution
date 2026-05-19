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
  collar_page: number | null;
  intercepts: Intercept[];
}

export interface GeoCentroid {
  east: number;
  north: number;
  rl: number;
}

export interface Metadata {
  project_name: string;
  prospects: string[];
  total_holes: number;
  total_intercepts: number;
  grade_range: { min: number; max: number };
  centroid: GeoCentroid;
  commodities: string[];
}
