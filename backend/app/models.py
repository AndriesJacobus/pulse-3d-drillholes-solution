from __future__ import annotations

from pydantic import BaseModel, field_validator, model_validator


class CollarRecord(BaseModel):
    hole_code: str
    prospect: str
    hole_type: str = ""
    sampling_type: str = ""
    drilling_purpose: str = ""
    latitude: float = 0.0
    longitude: float = 0.0
    east: float
    north: float
    rl: float
    dip: float
    azimuth: float
    total_depth: float
    epsg: int = 28351
    grid_name: str = ""
    axis_units: str = "metres"
    grid_confidence: str = ""
    drilling_start_date: str = ""
    drilling_end_date: str = ""
    collar_page: int | None = None

    @field_validator("dip")
    @classmethod
    def dip_in_range(cls, v: float) -> float:
        if not (-90 <= v <= 0):
            raise ValueError(f"Dip must be between -90 and 0, got {v}")
        return v

    @field_validator("azimuth")
    @classmethod
    def azimuth_in_range(cls, v: float) -> float:
        if not (0 <= v < 360):
            raise ValueError(f"Azimuth must be between 0 and 360, got {v}")
        return v

    @field_validator("total_depth")
    @classmethod
    def depth_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError(f"Total depth must be positive, got {v}")
        return v


class InterceptRecord(BaseModel):
    hole_code: str
    depth_from: float
    depth_to: float
    interval_m: float
    grade: float
    grade_unit: str = "g/t"
    commodity_symbol: str = "Au"
    cutoff_grade: float | None = None
    cutoff_unit: str = ""
    true_width: float | None = None
    true_width_estimated: str = ""
    depth_reference: str = ""
    assay_method: str = ""
    is_includes_subinterval: bool = False
    is_significant: bool = False
    parent_intercept_id: str = ""
    intercept_page: int | None = None

    @field_validator("grade")
    @classmethod
    def grade_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError(f"Grade must be positive, got {v}")
        return v

    @model_validator(mode="after")
    def depth_order(self) -> InterceptRecord:
        if self.depth_from >= self.depth_to:
            raise ValueError(
                f"depth_from ({self.depth_from}) must be less than depth_to ({self.depth_to})"
            )
        return self


class Point3D(BaseModel):
    x: float
    y: float
    z: float


class InterceptResponse(BaseModel):
    depth_from: float
    depth_to: float
    interval_m: float
    grade: float
    grade_unit: str
    commodity: str
    start_pos: Point3D
    end_pos: Point3D
    page: int | None = None


class DrillholeResponse(BaseModel):
    hole_code: str
    prospect: str
    collar: Point3D
    trace: list[Point3D]
    total_depth: float
    dip: float
    azimuth: float
    collar_page: int | None = None
    intercepts: list[InterceptResponse]


class GeoCentroid(BaseModel):
    east: float
    north: float
    rl: float


class QualityFindingResponse(BaseModel):
    severity: str
    category: str
    code: str
    message: str
    affected_rows: list[str]


class DataQualityResponse(BaseModel):
    summary: dict[str, int]
    findings: list[QualityFindingResponse]


class MetadataResponse(BaseModel):
    project_name: str
    prospects: list[str]
    total_holes: int
    total_intercepts: int
    grade_range: dict[str, float]
    centroid: GeoCentroid
    commodities: list[str]
