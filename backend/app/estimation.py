from __future__ import annotations

import math

import numpy as np
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF, ConstantKernel, WhiteKernel

from app.desurvey import compute_point_at_depth, to_scene_coords
from app.models import CollarRecord, GradeVoxel, InterceptRecord

CELL_SIZE_M = 10.0
SEARCH_RADIUS_M = 50.0
GRADE_CUTOFF = 0.3
BARREN_SAMPLE_INTERVAL_M = 20.0
LOG_EPSILON = 0.01


def _extract_sample_points(
    collars: list[CollarRecord],
    intercepts: list[InterceptRecord],
    centroid: tuple[float, float, float],
) -> tuple[np.ndarray, np.ndarray]:
    coords: list[tuple[float, float, float]] = []
    grades: list[float] = []

    intercepts_by_hole: dict[str, list[InterceptRecord]] = {}
    for ic in intercepts:
        intercepts_by_hole.setdefault(ic.hole_code, []).append(ic)

    for collar in collars:
        hole_intercepts = intercepts_by_hole.get(collar.hole_code, [])

        for ic in hole_intercepts:
            mid_depth = (ic.depth_from + ic.depth_to) / 2
            east, north, rl = compute_point_at_depth(
                collar.east, collar.north, collar.rl, collar.dip, collar.azimuth, mid_depth
            )
            pt = to_scene_coords(east, north, rl, centroid)
            coords.append((pt.x, pt.y, pt.z))
            grades.append(ic.grade)

        if not hole_intercepts:
            depth = BARREN_SAMPLE_INTERVAL_M
            while depth < collar.total_depth:
                east, north, rl = compute_point_at_depth(
                    collar.east, collar.north, collar.rl, collar.dip, collar.azimuth, depth
                )
                pt = to_scene_coords(east, north, rl, centroid)
                coords.append((pt.x, pt.y, pt.z))
                grades.append(0.0)
                depth += BARREN_SAMPLE_INTERVAL_M

    return np.array(coords), np.array(grades)


def _build_grid(
    coords: np.ndarray,
    cell_size: float,
    padding: float = 20.0,
) -> np.ndarray:
    mins = coords.min(axis=0) - padding
    maxs = coords.max(axis=0) + padding

    xs = np.arange(mins[0], maxs[0], cell_size)
    ys = np.arange(mins[1], maxs[1], cell_size)
    zs = np.arange(mins[2], maxs[2], cell_size)

    grid = np.array(np.meshgrid(xs, ys, zs, indexing="ij")).reshape(3, -1).T
    return grid


def _filter_by_distance(
    grid: np.ndarray,
    sample_coords: np.ndarray,
    max_distance: float,
) -> tuple[np.ndarray, np.ndarray]:
    from scipy.spatial import cKDTree

    tree = cKDTree(sample_coords)
    distances, _ = tree.query(grid)
    mask = distances <= max_distance
    return grid[mask], distances[mask]


def compute_grade_estimation(
    collars: list[CollarRecord],
    intercepts: list[InterceptRecord],
    centroid: tuple[float, float, float],
) -> list[GradeVoxel]:
    sample_coords, sample_grades = _extract_sample_points(collars, intercepts, centroid)

    if len(sample_coords) == 0:
        return []

    log_grades = np.log(sample_grades + LOG_EPSILON)

    kernel = ConstantKernel(1.0) * RBF(length_scale=50.0) + WhiteKernel(noise_level=0.1)
    gpr = GaussianProcessRegressor(
        kernel=kernel,
        normalize_y=True,
        n_restarts_optimizer=3,
        random_state=42,
    )
    gpr.fit(sample_coords, log_grades)

    grid = _build_grid(sample_coords, CELL_SIZE_M)
    grid_filtered, distances = _filter_by_distance(grid, sample_coords, SEARCH_RADIUS_M)

    if len(grid_filtered) == 0:
        return []

    log_mean, log_std = gpr.predict(grid_filtered, return_std=True)

    mean_grades = np.exp(log_mean) - LOG_EPSILON
    mean_grades = np.maximum(mean_grades, 0.0)

    max_observed = float(sample_grades.max())
    mean_grades = np.minimum(mean_grades, max_observed * 1.5)

    max_std = float(log_std.max()) if len(log_std) > 0 else 1.0
    if max_std < 1e-6:
        max_std = 1.0
    normalised_uncertainty = log_std / max_std

    voxels: list[GradeVoxel] = []
    for i in range(len(grid_filtered)):
        grade = float(mean_grades[i])
        if grade < GRADE_CUTOFF:
            continue

        uncertainty = float(normalised_uncertainty[i])
        opacity = max(0.05, 1.0 - uncertainty) * _distance_fade(distances[i], SEARCH_RADIUS_M)

        if opacity < 0.03:
            continue

        voxels.append(
            GradeVoxel(
                x=float(grid_filtered[i, 0]),
                y=float(grid_filtered[i, 1]),
                z=float(grid_filtered[i, 2]),
                grade=round(grade, 3),
                uncertainty=round(uncertainty, 3),
                opacity=round(opacity, 3),
            )
        )

    return voxels


def _distance_fade(distance: float, max_distance: float) -> float:
    if distance >= max_distance:
        return 0.0
    ratio = distance / max_distance
    return math.cos(ratio * math.pi / 2)
