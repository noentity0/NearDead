from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import demo, dispatch, hospitals, incidents, predictions

app = FastAPI(title="NearDead API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(hospitals.router, prefix="/v1/hospitals", tags=["hospitals"])
app.include_router(dispatch.router, prefix="/v1/dispatch", tags=["dispatch"])
app.include_router(incidents.router, prefix="/v1/incidents", tags=["incidents"])
app.include_router(predictions.router, prefix="/v1/predictions", tags=["predictions"])
app.include_router(demo.router, prefix="/v1/demo", tags=["demo"])


@app.get("/health")
def health():
    return {"ok": True, "service": "neardead-api"}

