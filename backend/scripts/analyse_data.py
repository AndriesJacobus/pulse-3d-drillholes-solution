#!/usr/bin/env python3
"""Data quality analysis for drillhole datasets.

Produces a structured report covering basic profiling, spatial analysis,
geometric validation, intercept cross-validation, statistical summary,
and near-duplicate detection.

Usage:
    python scripts/analyse_data.py --collars data/drillhole_collars.csv \
        --intercepts data/drill_intercepts.csv
    python scripts/analyse_data.py --collars data/drillhole_collars.csv \
        --intercepts data/drill_intercepts.csv --output report.json
"""

import argparse
import csv
import json
import math
import statistics
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path


@dataclass
class Finding:
    severity: str
    category: str
    code: str
    message: str
    affected_rows: list[str] = field(default_factory=list)


def _safe_float(value: str, default: float = 0.0) -> float:
    try:
        return float(value.strip())
    except (ValueError, AttributeError):
        return default


def _safe_int(value: str, default: int | None = None) -> int | None:
    try:
        return int(value.strip())
    except (ValueError, AttributeError):
        return default


def profile_columns(rows: list[dict], label: str) -> list[Finding]:
    findings: list[Finding] = []
    if not rows:
        findings.append(
            Finding(
                severity="error",
                category="completeness",
                code="EMPTY_DATASET",
                message=f"{label} dataset is empty",
            )
        )
        return findings

    all_keys = rows[0].keys()
    empty_cols = []
    for col in all_keys:
        values = [r.get(col, "").strip() for r in rows]
        non_empty = [v for v in values if v]
        if not non_empty:
            empty_cols.append(col)

    if empty_cols:
        findings.append(
            Finding(
                severity="info",
                category="completeness",
                code="EMPTY_COLUMNS",
                message=f"{label}: {len(empty_cols)} columns entirely empty: {', '.join(empty_cols)}",
            )
        )

    findings.append(
        Finding(
            severity="info",
            category="completeness",
            code="ROW_COUNT",
            message=f"{label}: {len(rows)} rows, {len(all_keys)} columns",
        )
    )

    return findings


def check_spatial_outliers(
    collars: list[dict],
    threshold_std: float = 3.0,
) -> list[Finding]:
    findings: list[Finding] = []

    prospects: dict[str, list[dict]] = {}
    for c in collars:
        prospects.setdefault(c["prospect"], []).append(c)

    for prospect, group in prospects.items():
        if len(group) < 3:
            continue

        easts = [_safe_float(c["east"]) for c in group]
        norths = [_safe_float(c["north"]) for c in group]
        mean_e = statistics.mean(easts)
        mean_n = statistics.mean(norths)

        distances = [
            math.sqrt((e - mean_e) ** 2 + (n - mean_n) ** 2)
            for e, n in zip(easts, norths, strict=True)
        ]
        if not distances or max(distances) == 0:
            continue

        mean_dist = statistics.mean(distances)
        std_dist = statistics.stdev(distances) if len(distances) > 1 else 0
        if std_dist == 0:
            continue

        for collar, dist in zip(group, distances, strict=True):
            z_score = (dist - mean_dist) / std_dist
            if z_score > threshold_std:
                findings.append(
                    Finding(
                        severity="warning",
                        category="spatial",
                        code="SPATIAL_OUTLIER",
                        message=(
                            f"{collar['hole_code']} is {dist:.0f}m from {prospect} centroid "
                            f"(z-score: {z_score:.1f})"
                        ),
                        affected_rows=[collar["hole_code"]],
                    )
                )

    return findings


def check_near_duplicates(
    collars: list[dict],
    distance_m: float = 5.0,
) -> list[Finding]:
    findings: list[Finding] = []
    for i, a in enumerate(collars):
        for b in collars[i + 1 :]:
            dist = math.sqrt(
                (_safe_float(a["east"]) - _safe_float(b["east"])) ** 2
                + (_safe_float(a["north"]) - _safe_float(b["north"])) ** 2
            )
            if dist < distance_m:
                findings.append(
                    Finding(
                        severity="info",
                        category="spatial",
                        code="NEAR_DUPLICATE",
                        message=(
                            f"{a['hole_code']} and {b['hole_code']} are {dist:.1f}m apart "
                            f"(shared collar pad)"
                        ),
                        affected_rows=[a["hole_code"], b["hole_code"]],
                    )
                )
    return findings


def check_geometric_rules(collars: list[dict]) -> list[Finding]:
    findings: list[Finding] = []

    for c in collars:
        dip = _safe_float(c.get("dip", "0"))
        azimuth = _safe_float(c.get("azimuth", "0"))

        if dip == -90 and azimuth != 0:
            findings.append(
                Finding(
                    severity="info",
                    category="geometric",
                    code="VERTICAL_AZIMUTH",
                    message=(
                        f"{c['hole_code']} is vertical (dip=-90) with azimuth={azimuth}. "
                        f"Azimuth is irrelevant for vertical holes."
                    ),
                    affected_rows=[c["hole_code"]],
                )
            )

        if not (-90 <= dip <= 0):
            findings.append(
                Finding(
                    severity="error",
                    category="geometric",
                    code="DIP_OUT_OF_RANGE",
                    message=f"{c['hole_code']} has dip={dip} (expected -90 to 0)",
                    affected_rows=[c["hole_code"]],
                )
            )

        if not (0 <= azimuth < 360):
            findings.append(
                Finding(
                    severity="error",
                    category="geometric",
                    code="AZIMUTH_OUT_OF_RANGE",
                    message=f"{c['hole_code']} has azimuth={azimuth} (expected 0 to 360)",
                    affected_rows=[c["hole_code"]],
                )
            )

    prospects: dict[str, list[float]] = {}
    for c in collars:
        prospects.setdefault(c["prospect"], []).append(_safe_float(c["rl"]))

    for prospect, rls in prospects.items():
        unique_rls = sorted(set(rls))
        if len(unique_rls) > 1:
            rl_range = max(unique_rls) - min(unique_rls)
            if rl_range > 5:
                findings.append(
                    Finding(
                        severity="info",
                        category="geometric",
                        code="RL_VARIATION",
                        message=(
                            f"{prospect}: RL varies by {rl_range:.0f}m "
                            f"({min(unique_rls):.0f} to {max(unique_rls):.0f})"
                        ),
                    )
                )

    return findings


def check_intercept_integrity(
    collars: list[dict],
    intercepts: list[dict],
) -> list[Finding]:
    findings: list[Finding] = []

    collar_map = {c["hole_code"]: c for c in collars}

    orphans = [i["hole_code"] for i in intercepts if i["hole_code"] not in collar_map]
    if orphans:
        findings.append(
            Finding(
                severity="error",
                category="consistency",
                code="ORPHAN_INTERCEPTS",
                message=f"{len(orphans)} intercepts reference unknown hole codes",
                affected_rows=orphans,
            )
        )

    for i in intercepts:
        depth_from = _safe_float(i["depth_from"])
        depth_to = _safe_float(i["depth_to"])
        interval_m = _safe_float(i["interval_m"])

        if depth_from >= depth_to:
            findings.append(
                Finding(
                    severity="error",
                    category="consistency",
                    code="DEPTH_ORDER",
                    message=(
                        f"{i['hole_code']}: depth_from ({depth_from}) >= depth_to ({depth_to})"
                    ),
                    affected_rows=[i["hole_code"]],
                )
            )

        expected_interval = depth_to - depth_from
        if abs(interval_m - expected_interval) > 0.01:
            findings.append(
                Finding(
                    severity="error",
                    category="consistency",
                    code="DERIVED_MISMATCH",
                    message=(
                        f"{i['hole_code']}: interval_m ({interval_m}) != "
                        f"depth_to - depth_from ({expected_interval})"
                    ),
                    affected_rows=[i["hole_code"]],
                )
            )

        collar = collar_map.get(i["hole_code"])
        if collar:
            total_depth = _safe_float(collar["total_depth"])
            if depth_to > total_depth:
                findings.append(
                    Finding(
                        severity="warning",
                        category="consistency",
                        code="DEPTH_EXCEEDS_TOTAL",
                        message=(
                            f"{i['hole_code']}: intercept depth_to ({depth_to}) "
                            f"exceeds total_depth ({total_depth})"
                        ),
                        affected_rows=[i["hole_code"]],
                    )
                )

    holes_with_intercepts = {i["hole_code"] for i in intercepts}
    barren = [c["hole_code"] for c in collars if c["hole_code"] not in holes_with_intercepts]
    barren_pct = len(barren) / len(collars) * 100 if collars else 0
    findings.append(
        Finding(
            severity="info",
            category="completeness",
            code="BARREN_HOLES",
            message=f"{len(barren)} of {len(collars)} holes ({barren_pct:.0f}%) have no intercepts",
            affected_rows=barren,
        )
    )

    return findings


def compute_grade_statistics(intercepts: list[dict]) -> dict:
    grades = [_safe_float(i["grade"]) for i in intercepts if i.get("grade")]
    if not grades:
        return {"count": 0}

    return {
        "count": len(grades),
        "min": min(grades),
        "max": max(grades),
        "mean": round(statistics.mean(grades), 2),
        "median": round(statistics.median(grades), 2),
        "stdev": round(statistics.stdev(grades), 2) if len(grades) > 1 else 0,
        "percentiles": {
            "p25": round(sorted(grades)[len(grades) // 4], 2),
            "p75": round(sorted(grades)[3 * len(grades) // 4], 2),
        },
    }


def compute_spatial_statistics(collars: list[dict]) -> dict:
    easts = [_safe_float(c["east"]) for c in collars]
    norths = [_safe_float(c["north"]) for c in collars]
    rls = [_safe_float(c["rl"]) for c in collars]

    return {
        "east_range": {"min": min(easts), "max": max(easts), "span": max(easts) - min(easts)},
        "north_range": {"min": min(norths), "max": max(norths), "span": max(norths) - min(norths)},
        "rl_range": {"min": min(rls), "max": max(rls), "span": max(rls) - min(rls)},
        "centroid": {
            "east": round(statistics.mean(easts), 2),
            "north": round(statistics.mean(norths), 2),
            "rl": round(statistics.mean(rls), 2),
        },
        "prospect_counts": {
            prospect: len([c for c in collars if c["prospect"] == prospect])
            for prospect in sorted({c["prospect"] for c in collars})
        },
    }


def run_analysis(collars_path: Path, intercepts_path: Path) -> dict:
    with collars_path.open(newline="") as f:
        collars = list(csv.DictReader(f))
    with intercepts_path.open(newline="") as f:
        intercepts = list(csv.DictReader(f))

    findings: list[Finding] = []
    findings.extend(profile_columns(collars, "collars"))
    findings.extend(profile_columns(intercepts, "intercepts"))
    findings.extend(check_spatial_outliers(collars))
    findings.extend(check_near_duplicates(collars))
    findings.extend(check_geometric_rules(collars))
    findings.extend(check_intercept_integrity(collars, intercepts))

    return {
        "summary": {
            "total_collars": len(collars),
            "total_intercepts": len(intercepts),
            "prospects": sorted({r["prospect"] for r in collars}),
            "findings_by_severity": {
                s: len([f for f in findings if f.severity == s])
                for s in ["error", "warning", "info"]
            },
        },
        "grade_statistics": compute_grade_statistics(intercepts),
        "spatial_statistics": compute_spatial_statistics(collars),
        "findings": [asdict(f) for f in findings],
    }


def print_report(report: dict) -> None:
    summary = report["summary"]
    print("=" * 60)
    print("DRILLHOLE DATA QUALITY REPORT")
    print("=" * 60)
    print(
        f"\nDataset: {summary['total_collars']} collars, {summary['total_intercepts']} intercepts"
    )
    print(f"Prospects: {', '.join(summary['prospects'])}")
    print(f"\nFindings: {summary['findings_by_severity']}")

    grade = report["grade_statistics"]
    if grade.get("count", 0) > 0:
        print("\nGrade statistics (g/t Au):")
        print(f"  Range: {grade['min']} - {grade['max']}")
        print(f"  Mean: {grade['mean']}, Median: {grade['median']}, Stdev: {grade['stdev']}")

    spatial = report["spatial_statistics"]
    print("\nSpatial extent:")
    print(f"  East: {spatial['east_range']['span']:.0f}m span")
    print(f"  North: {spatial['north_range']['span']:.0f}m span")
    print(f"  RL: {spatial['rl_range']['span']:.0f}m span")
    print(f"  Prospects: {spatial['prospect_counts']}")

    print(f"\n{'─' * 60}")
    print("FINDINGS")
    print(f"{'─' * 60}")
    for f in report["findings"]:
        icon = {"error": "!!", "warning": "! ", "info": "  "}[f["severity"]]
        print(f"  [{icon}] [{f['category']}] {f['code']}")
        print(f"       {f['message']}")
        if f["affected_rows"]:
            print(f"       Affected: {', '.join(f['affected_rows'][:10])}")
    print()


def main():
    parser = argparse.ArgumentParser(description="Analyse drillhole data quality")
    parser.add_argument("--collars", required=True, type=Path)
    parser.add_argument("--intercepts", required=True, type=Path)
    parser.add_argument("--output", type=Path, help="Write JSON report to file")
    args = parser.parse_args()

    if not args.collars.exists():
        print(f"Error: collars file not found: {args.collars}", file=sys.stderr)
        sys.exit(1)
    if not args.intercepts.exists():
        print(f"Error: intercepts file not found: {args.intercepts}", file=sys.stderr)
        sys.exit(1)

    report = run_analysis(args.collars, args.intercepts)
    print_report(report)

    if args.output:
        args.output.write_text(json.dumps(report, indent=2))
        print(f"JSON report written to {args.output}")


if __name__ == "__main__":
    main()
