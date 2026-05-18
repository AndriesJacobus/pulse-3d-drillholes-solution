import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.config import (
    COLLARS_PATH,
    CORS_ORIGINS,
    INTERCEPTS_PATH,
    PDF_PATH,
    PROJECT_NAME,
    SAMPLE_INTERVAL_M,
)
from app.desurvey import (
    compute_centroid,
    compute_intercept_positions,
    desurvey_hole,
    to_scene_coords,
)
from app.loader import load_collars, load_intercepts
from app.models import (
    CollarRecord,
    DataQualityResponse,
    DrillholeResponse,
    GeoCentroid,
    InterceptRecord,
    InterceptResponse,
    MetadataResponse,
    QualityFindingResponse,
)
from app.quality import QualityReport, run_quality_report

logger = logging.getLogger(__name__)


def build_drillhole_responses(
    collars: list[CollarRecord],
    intercepts: list[InterceptRecord],
    centroid: tuple[float, float, float],
) -> list[DrillholeResponse]:
    intercepts_by_hole: dict[str, list[InterceptRecord]] = {}
    for i in intercepts:
        intercepts_by_hole.setdefault(i.hole_code, []).append(i)

    responses: list[DrillholeResponse] = []
    for collar in collars:
        hole_intercepts = intercepts_by_hole.get(collar.hole_code, [])

        intercept_depths: list[float] = []
        for ic in hole_intercepts:
            intercept_depths.extend([ic.depth_from, ic.depth_to])

        trace = desurvey_hole(collar, intercept_depths, centroid, SAMPLE_INTERVAL_M)
        collar_pos = to_scene_coords(collar.east, collar.north, collar.rl, centroid)

        intercept_responses: list[InterceptResponse] = []
        for ic in hole_intercepts:
            start_pos, end_pos = compute_intercept_positions(
                collar,
                ic.depth_from,
                ic.depth_to,
                centroid,
            )
            intercept_responses.append(
                InterceptResponse(
                    depth_from=ic.depth_from,
                    depth_to=ic.depth_to,
                    interval_m=ic.interval_m,
                    grade=ic.grade,
                    grade_unit=ic.grade_unit,
                    commodity=ic.commodity_symbol,
                    start_pos=start_pos,
                    end_pos=end_pos,
                    page=ic.intercept_page,
                )
            )

        responses.append(
            DrillholeResponse(
                hole_code=collar.hole_code,
                prospect=collar.prospect,
                collar=collar_pos,
                trace=trace,
                total_depth=collar.total_depth,
                dip=collar.dip,
                azimuth=collar.azimuth,
                collar_page=collar.collar_page,
                intercepts=intercept_responses,
            )
        )

    return responses


def build_metadata(
    collars: list[CollarRecord],
    intercepts: list[InterceptRecord],
    centroid: tuple[float, float, float],
) -> MetadataResponse:
    grades = [i.grade for i in intercepts]
    return MetadataResponse(
        project_name=PROJECT_NAME,
        prospects=sorted({c.prospect for c in collars}),
        total_holes=len(collars),
        total_intercepts=len(intercepts),
        grade_range={
            "min": min(grades) if grades else 0,
            "max": max(grades) if grades else 0,
        },
        centroid=GeoCentroid(east=centroid[0], north=centroid[1], rl=centroid[2]),
        commodities=sorted({i.commodity_symbol for i in intercepts}),
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    collars = load_collars(COLLARS_PATH)
    intercepts = load_intercepts(INTERCEPTS_PATH, {c.hole_code for c in collars})
    centroid = compute_centroid(collars)

    logger.info("Loaded %d collars, %d intercepts", len(collars), len(intercepts))

    app.state.drillholes = build_drillhole_responses(collars, intercepts, centroid)
    app.state.metadata = build_metadata(collars, intercepts, centroid)
    app.state.quality_report = run_quality_report(collars, intercepts)

    yield


app = FastAPI(title="Pulse Drillholes API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET"],
    allow_headers=["Accept", "Content-Type"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/metadata", response_model=MetadataResponse)
async def get_metadata(request: Request):
    return request.app.state.metadata


@app.get("/api/drillholes", response_model=list[DrillholeResponse])
async def get_drillholes(request: Request):
    return request.app.state.drillholes


@app.get("/api/source-pdf")
async def get_source_pdf():
    if not PDF_PATH.exists():
        raise HTTPException(status_code=404, detail="Source PDF not found")
    return FileResponse(PDF_PATH, media_type="application/pdf", filename="source.pdf")


@app.get("/api/data-quality", response_model=DataQualityResponse)
async def get_data_quality(request: Request):
    report: QualityReport = request.app.state.quality_report
    return DataQualityResponse(
        summary=report.summary,
        findings=[
            QualityFindingResponse(
                severity=f.severity,
                category=f.category,
                code=f.code,
                message=f.message,
                affected_rows=f.affected_rows,
            )
            for f in report.findings
        ],
    )
