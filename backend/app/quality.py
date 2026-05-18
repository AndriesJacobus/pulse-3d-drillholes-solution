from __future__ import annotations

import math
import statistics
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Literal

if TYPE_CHECKING:
    from app.models import CollarRecord, InterceptRecord


@dataclass
class QualityFinding:
    severity: Literal["error", "warning", "info"]
    category: str
    code: str
    message: str
    affected_rows: list[str] = field(default_factory=list)


@dataclass
class QualityReport:
    findings: list[QualityFinding]
    summary: dict[str, int]


def check_spatial_outliers(
    collars: list[CollarRecord], threshold_std: float = 3.0
) -> list[QualityFinding]:
    findings: list[QualityFinding] = []

    prospects: dict[str, list[CollarRecord]] = {}
    for c in collars:
        prospects.setdefault(c.prospect, []).append(c)

    for prospect, group in prospects.items():
        if len(group) < 3:
            continue

        easts = [c.east for c in group]
        norths = [c.north for c in group]
        mean_e = statistics.mean(easts)
        mean_n = statistics.mean(norths)

        distances = [math.sqrt((c.east - mean_e) ** 2 + (c.north - mean_n) ** 2) for c in group]
        if max(distances) == 0:
            continue

        mean_dist = statistics.mean(distances)
        std_dist = statistics.stdev(distances) if len(distances) > 1 else 0

        if std_dist == 0:
            continue

        for collar, dist in zip(group, distances, strict=True):
            z_score = (dist - mean_dist) / std_dist
            if z_score > threshold_std:
                findings.append(
                    QualityFinding(
                        severity="warning",
                        category="spatial",
                        code="SPATIAL_OUTLIER",
                        message=(
                            f"{collar.hole_code} is {dist:.0f}m from {prospect} centroid "
                            f"(z-score: {z_score:.1f})"
                        ),
                        affected_rows=[collar.hole_code],
                    )
                )

    return findings


def check_completeness(
    collars: list[CollarRecord], intercepts: list[InterceptRecord]
) -> list[QualityFinding]:
    findings: list[QualityFinding] = []

    holes_with_intercepts = {i.hole_code for i in intercepts}
    barren_holes = [c for c in collars if c.hole_code not in holes_with_intercepts]
    barren_pct = len(barren_holes) / len(collars) * 100 if collars else 0

    if barren_pct > 40:
        findings.append(
            QualityFinding(
                severity="info",
                category="completeness",
                code="BARREN_HOLES",
                message=(
                    f"{len(barren_holes)} of {len(collars)} holes ({barren_pct:.0f}%) "
                    f"have no intercepts"
                ),
                affected_rows=[c.hole_code for c in barren_holes],
            )
        )

    empty_fields = []
    if collars:
        for fname in ["grid_name", "drilling_start_date", "drilling_end_date"]:
            if all(getattr(c, fname, "") == "" for c in collars):
                empty_fields.append(fname)
    if empty_fields:
        findings.append(
            QualityFinding(
                severity="info",
                category="completeness",
                code="EMPTY_COLUMNS",
                message=f"Columns with no data: {', '.join(empty_fields)}",
                affected_rows=[],
            )
        )

    return findings


def check_derived_consistency(
    intercepts: list[InterceptRecord],
) -> list[QualityFinding]:
    findings: list[QualityFinding] = []

    inconsistent = []
    for i in intercepts:
        expected = i.depth_to - i.depth_from
        if abs(i.interval_m - expected) > 0.01:
            inconsistent.append(i.hole_code)

    if inconsistent:
        findings.append(
            QualityFinding(
                severity="error",
                category="consistency",
                code="DERIVED_FIELD_MISMATCH",
                message=(
                    f"{len(inconsistent)} intercepts have interval_m != depth_to - depth_from"
                ),
                affected_rows=inconsistent,
            )
        )

    return findings


def check_domain_rules(collars: list[CollarRecord]) -> list[QualityFinding]:
    findings: list[QualityFinding] = []

    for c in collars:
        if c.dip == -90 and c.azimuth != 0:
            findings.append(
                QualityFinding(
                    severity="info",
                    category="geometric",
                    code="VERTICAL_AZIMUTH",
                    message=(
                        f"{c.hole_code} is vertical (dip=-90) but azimuth={c.azimuth}. "
                        f"Azimuth has no effect on vertical holes."
                    ),
                    affected_rows=[c.hole_code],
                )
            )

    prospects: dict[str, list[float]] = {}
    for c in collars:
        prospects.setdefault(c.prospect, []).append(c.rl)

    for prospect, rls in prospects.items():
        unique_rls = sorted(set(rls))
        if len(unique_rls) > 1:
            rl_range = max(unique_rls) - min(unique_rls)
            if rl_range > 5:
                findings.append(
                    QualityFinding(
                        severity="info",
                        category="geometric",
                        code="RL_VARIATION",
                        message=(
                            f"{prospect}: RL varies by {rl_range:.0f}m "
                            f"({min(unique_rls):.0f} to {max(unique_rls):.0f})"
                        ),
                        affected_rows=[],
                    )
                )

    return findings


def check_grade_outliers(intercepts: list[InterceptRecord]) -> list[QualityFinding]:
    findings: list[QualityFinding] = []
    if len(intercepts) < 3:
        return findings

    grades = [i.grade for i in intercepts]
    mean_grade = statistics.mean(grades)
    std_grade = statistics.stdev(grades)

    if std_grade == 0:
        return findings

    for i in intercepts:
        z_score = (i.grade - mean_grade) / std_grade
        if z_score > 2.0:
            findings.append(
                QualityFinding(
                    severity="info",
                    category="statistical",
                    code="GRADE_OUTLIER",
                    message=(
                        f"{i.hole_code} grade {i.grade} {i.grade_unit} "
                        f"is {z_score:.1f} std above mean ({mean_grade:.2f})"
                    ),
                    affected_rows=[i.hole_code],
                )
            )

    return findings


def check_near_duplicates(
    collars: list[CollarRecord], distance_m: float = 5.0
) -> list[QualityFinding]:
    findings: list[QualityFinding] = []
    checked: set[tuple[str, str]] = set()

    for i, a in enumerate(collars):
        for b in collars[i + 1 :]:
            pair = tuple(sorted([a.hole_code, b.hole_code]))
            if pair in checked:
                continue
            checked.add(pair)

            dist = math.sqrt((a.east - b.east) ** 2 + (a.north - b.north) ** 2)
            if dist < distance_m:
                findings.append(
                    QualityFinding(
                        severity="info",
                        category="spatial",
                        code="NEAR_DUPLICATE",
                        message=(
                            f"{a.hole_code} and {b.hole_code} are {dist:.1f}m apart "
                            f"(twin/fan holes at shared collar pad)"
                        ),
                        affected_rows=[a.hole_code, b.hole_code],
                    )
                )

    return findings


def run_quality_report(
    collars: list[CollarRecord], intercepts: list[InterceptRecord]
) -> QualityReport:
    all_findings: list[QualityFinding] = []
    all_findings.extend(check_spatial_outliers(collars))
    all_findings.extend(check_completeness(collars, intercepts))
    all_findings.extend(check_derived_consistency(intercepts))
    all_findings.extend(check_domain_rules(collars))
    all_findings.extend(check_grade_outliers(intercepts))
    all_findings.extend(check_near_duplicates(collars))

    severity_counts = {"error": 0, "warning": 0, "info": 0}
    for f in all_findings:
        severity_counts[f.severity] += 1

    return QualityReport(findings=all_findings, summary=severity_counts)
