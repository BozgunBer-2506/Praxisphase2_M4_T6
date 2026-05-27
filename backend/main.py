from fastapi import FastAPI

app = FastAPI(title="DnD Visual Novel API")


@app.get("/health")
def health():
    return {"status": "ok"}
