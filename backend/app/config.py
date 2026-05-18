from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

COLLARS_PATH = DATA_DIR / "drillhole_collars.csv"
INTERCEPTS_PATH = DATA_DIR / "drill_intercepts.csv"
PDF_PATH = DATA_DIR / "source.pdf"

CORS_ORIGINS: list[str] = [
    "http://localhost:5173",
    "http://localhost:3000",
]

SAMPLE_INTERVAL_M = 5.0
