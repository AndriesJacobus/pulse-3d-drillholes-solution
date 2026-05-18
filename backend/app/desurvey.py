from __future__ import annotations

import math

from app.models import CollarRecord, Point3D


def compute_point_at_depth(
    collar_east: float,
    collar_north: float,
    collar_rl: float,
    dip: float,
    azimuth: float,
    depth: float,
) -> tuple[float, float, float]:
    dip_rad = math.radians(dip)
    az_rad = math.radians(azimuth)

    dx = depth * math.cos(dip_rad) * math.sin(az_rad)
    dy = depth * math.cos(dip_rad) * math.cos(az_rad)
    dz = depth * math.sin(dip_rad)

    return (collar_east + dx, collar_north + dy, collar_rl + dz)


def compute_centroid(collars: list[CollarRecord]) -> tuple[float, float, float]:
    n = len(collars)
    if n == 0:
        return (0.0, 0.0, 0.0)
    sum_e = sum(c.east for c in collars)
    sum_n = sum(c.north for c in collars)
    sum_rl = sum(c.rl for c in collars)
    return (sum_e / n, sum_n / n, sum_rl / n)


def to_scene_coords(
    east: float,
    north: float,
    rl: float,
    centroid: tuple[float, float, float],
) -> Point3D:
    return Point3D(
        x=east - centroid[0],
        y=rl - centroid[2],
        z=-(north - centroid[1]),
    )


def desurvey_hole(
    collar: CollarRecord,
    intercept_depths: list[float],
    centroid: tuple[float, float, float],
    sample_interval: float = 5.0,
) -> list[Point3D]:
    depths: set[float] = {0.0, collar.total_depth}

    d = sample_interval
    while d < collar.total_depth:
        depths.add(d)
        d += sample_interval

    for depth in intercept_depths:
        if 0 <= depth <= collar.total_depth:
            depths.add(depth)

    sorted_depths = sorted(depths)

    trace: list[Point3D] = []
    for depth in sorted_depths:
        east, north, rl = compute_point_at_depth(
            collar.east,
            collar.north,
            collar.rl,
            collar.dip,
            collar.azimuth,
            depth,
        )
        trace.append(to_scene_coords(east, north, rl, centroid))

    return trace


def compute_intercept_positions(
    collar: CollarRecord,
    depth_from: float,
    depth_to: float,
    centroid: tuple[float, float, float],
) -> tuple[Point3D, Point3D]:
    e1, n1, rl1 = compute_point_at_depth(
        collar.east,
        collar.north,
        collar.rl,
        collar.dip,
        collar.azimuth,
        depth_from,
    )
    e2, n2, rl2 = compute_point_at_depth(
        collar.east,
        collar.north,
        collar.rl,
        collar.dip,
        collar.azimuth,
        depth_to,
    )
    return (
        to_scene_coords(e1, n1, rl1, centroid),
        to_scene_coords(e2, n2, rl2, centroid),
    )
