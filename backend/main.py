from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from datetime import datetime, timezone
import json

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
# PATHS
# =========================================================

BASE_DIR = Path(__file__).resolve().parent.parent

FRONTEND_PATH = BASE_DIR / "frontend"

DATA_PATH = BASE_DIR / "data"

INCIDENTS_FILE = DATA_PATH / "incidents.json"


# =========================================================
# INCIDENT STORAGE
# =========================================================

def ensure_storage():
    """
    Make sure the local incident storage exists.
    """

    DATA_PATH.mkdir(
        parents=True,
        exist_ok=True
    )

    if not INCIDENTS_FILE.exists():

        INCIDENTS_FILE.write_text(
            "[]",
            encoding="utf-8"
        )


def load_incidents():
    """
    Load all locally stored incidents.
    """

    ensure_storage()

    try:

        content = INCIDENTS_FILE.read_text(
            encoding="utf-8"
        )

        incidents = json.loads(content)

        if isinstance(incidents, list):
            return incidents

        return []

    except (json.JSONDecodeError, OSError):

        return []


def save_incidents(incidents):
    """
    Save incidents to the local JSON file.
    """

    ensure_storage()

    INCIDENTS_FILE.write_text(
        json.dumps(
            incidents,
            ensure_ascii=False,
            indent=2
        ),
        encoding="utf-8"
    )


def save_incident(
    incident_text: str,
    analysis: str
):
    """
    Store a completed incident analysis locally.
    """

    incidents = load_incidents()

    incident_number = len(incidents) + 1

    incident = {
        "id": f"INC-{incident_number:04d}",
        "incident": incident_text,
        "analysis": analysis,
        "created_at": datetime.now(
            timezone.utc
        ).isoformat()
    }

    incidents.insert(
        0,
        incident
    )

    save_incidents(
        incidents
    )

    return incident


# Make sure storage exists when the application starts.
ensure_storage()


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
def analyze_incident(
    request: IncidentRequest
):

    incident_text = request.incident.strip()

    if not incident_text:

        return {
            "success": False,
            "error": "Incident description cannot be empty."
        }

    try:

        # Initialize the model only when it is needed.
        if incident_ai.client is None:

            incident_ai.initialize()

        # Analyze the incident with the local AI model.
        result = incident_ai.analyze_incident(
            incident_text
        )

        # Save the completed analysis locally.
        saved_incident = save_incident(
            incident_text,
            result
        )

        return {
            "success": True,
            "analysis": result,
            "incident": saved_incident
        }

    except Exception as e:

        return {
            "success": False,
            "error": str(e)
        }


# =========================================================
# INCIDENT HISTORY
# =========================================================

@app.get("/api/incidents")
def get_incidents():

    try:

        incidents = load_incidents()

        return {
            "success": True,
            "incidents": incidents,
            "count": len(incidents)
        }

    except Exception as e:

        return {
            "success": False,
            "error": str(e),
            "incidents": []
        }


# =========================================================
# SINGLE INCIDENT
# =========================================================

@app.get("/api/incidents/{incident_id}")
def get_incident(
    incident_id: str
):

    incidents = load_incidents()

    for incident in incidents:

        if incident["id"] == incident_id:

            return {
                "success": True,
                "incident": incident
            }

    raise HTTPException(
        status_code=404,
        detail="Incident not found."
    )


# =========================================================
# DELETE INCIDENT
# =========================================================

@app.delete("/api/incidents/{incident_id}")
def delete_incident(
    incident_id: str
):

    incidents = load_incidents()

    updated_incidents = [
        incident
        for incident in incidents
        if incident["id"] != incident_id
    ]

    if len(updated_incidents) == len(incidents):

        raise HTTPException(
            status_code=404,
            detail="Incident not found."
        )

    save_incidents(
        updated_incidents
    )

    return {
        "success": True,
        "message": "Incident deleted successfully."
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
            "message": "Model shut down successfully."
        }

    except Exception as e:

        return {
            "success": False,
            "error": str(e)
        }


# =========================================================
# FRONTEND
# =========================================================

# Serve the frontend application from the project root.

app.mount(
    "/",
    StaticFiles(
        directory=FRONTEND_PATH,
        html=True
    ),
    name="frontend"
)