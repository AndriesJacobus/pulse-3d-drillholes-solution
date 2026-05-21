from __future__ import annotations

import numpy as np
from sklearn.cluster import DBSCAN

from app.desurvey import to_scene_coords
from app.models import ClusterResponse, CollarRecord, Point3D

CLUSTER_EPS_M = 100.0
CLUSTER_MIN_SAMPLES = 2


def compute_clusters(
    collars: list[CollarRecord],
    centroid: tuple[float, float, float],
) -> list[ClusterResponse]:
    if len(collars) < 2:
        return []

    coords_2d = np.array([[c.east, c.north] for c in collars])
    labels = DBSCAN(eps=CLUSTER_EPS_M, min_samples=CLUSTER_MIN_SAMPLES).fit_predict(coords_2d)

    cluster_map: dict[int, list[int]] = {}
    for i, label in enumerate(labels):
        if label == -1:
            continue
        cluster_map.setdefault(label, []).append(i)

    results: list[ClusterResponse] = []
    for label in sorted(cluster_map.keys()):
        indices = cluster_map[label]
        members = [collars[i] for i in indices]
        hole_codes = [c.hole_code for c in members]

        prospect_counts: dict[str, int] = {}
        for c in members:
            prospect_counts[c.prospect] = prospect_counts.get(c.prospect, 0) + 1
        dominant_prospect = max(prospect_counts, key=lambda k: prospect_counts[k])

        scene_points = [to_scene_coords(c.east, c.north, c.rl, centroid) for c in members]
        cx = sum(p.x for p in scene_points) / len(scene_points)
        cy = sum(p.y for p in scene_points) / len(scene_points)
        cz = sum(p.z for p in scene_points) / len(scene_points)

        min_x = min(p.x for p in scene_points)
        max_x = max(p.x for p in scene_points)
        min_z = min(p.z for p in scene_points)
        max_z = max(p.z for p in scene_points)
        radius = max(
            ((max_x - min_x) / 2),
            ((max_z - min_z) / 2),
            30.0,
        )

        avg_lat = sum(c.latitude for c in members) / len(members)
        avg_lon = sum(c.longitude for c in members) / len(members)

        cluster_label = f"Cluster {len(results) + 1}"

        results.append(
            ClusterResponse(
                id=len(results),
                label=cluster_label,
                prospect=dominant_prospect,
                centroid=Point3D(x=cx, y=cy, z=cz),
                radius=radius,
                hole_codes=hole_codes,
                latitude=avg_lat,
                longitude=avg_lon,
            )
        )

    return results
