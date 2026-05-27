from fastapi import FastAPI
from database import engine

app = FastAPI(title="DnD Visual Novel API")


@app.get("/health")
def health():
    try:
        with engine.connect():
            db_status = "ok"
    except Exception:
        db_status = "unreachable"
    return {"status": "ok", "database": db_status}
