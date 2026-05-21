import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

COLLARS_PATH = DATA_DIR / "drillhole_collars.csv"
INTERCEPTS_PATH = DATA_DIR / "drill_intercepts.csv"
PDF_PATH = DATA_DIR / "source.pdf"

_default_origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:3000",
]
_env_origins = os.environ.get("CORS_ORIGINS", "")
CORS_ORIGINS: list[str] = (
    [o.strip() for o in _env_origins.split(",") if o.strip()] if _env_origins else _default_origins
)

PROJECT_NAME = os.environ.get("PROJECT_NAME", "Comet Vale Gold Project")

SAMPLE_INTERVAL_M = 5.0
