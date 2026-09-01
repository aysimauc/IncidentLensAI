from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
from fastapi.staticfiles import StaticFiles

from backend.ai_engine import incident_ai


# =========================================================
# INCIDENTLENS AI
# FastAPI Backend
# =========================================================

app = FastAPI(
    title="IncidentLens AI",
    description="AI-powered technical incident analysis platform",
    version="1.0.0"
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# REQUEST MODEL
# =========================================================

class IncidentRequest(BaseModel):
    incident: str


# =========================================================
# AI HEALTH
# =========================================================

@app.get("/api/health")
def health():
    return {
        "status": "online",
        "model_loaded": incident_ai.client is not None
    }


# =========================================================
# INCIDENT ANALYSIS
# =========================================================

@app.post("/api/analyze")
def analyze_incident(request: IncidentRequest):

    if not request.incident.strip():
        return {
            "success": False,
            "error": "Incident açıklaması boş olamaz."
        }

    try:

        # Model henüz başlatılmadıysa başlat
        if incident_ai.client is None:
            incident_ai.initialize()

        result = incident_ai.analyze_incident(
            request.incident
        )

        return {
            "success": True,
            "analysis": result
        }

    except Exception as e:

        return {
            "success": False,
            "error": str(e)
        }


# =========================================================
# MODEL SHUTDOWN
# =========================================================

@app.post("/api/shutdown")
def shutdown():

    try:

        incident_ai.shutdown()

        return {
            "success": True,
            "message": "Model kapatıldı."
        }

    except Exception as e:

        return {
            "success": False,
            "error": str(e)
        }


# =========================================================
# FRONTEND
# =========================================================

frontend_path = (
    Path(__file__).resolve().parent.parent / "frontend"
)


# Frontend klasörünü ana web uygulaması olarak sun
# Böylece:
#
# http://127.0.0.1:8000/
#        ↓
# frontend/index.html
#
# /app.js
# /style.css
# gibi dosyalar da otomatik olarak çalışır.

app.mount(
    "/",
    StaticFiles(
        directory=frontend_path,
        html=True
    ),
    name="frontend"
)