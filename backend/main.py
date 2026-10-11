"""
Real-Time Wearable Health Anomaly Radar
FastAPI Application & WebSocket Streaming Service (main.py)
"""

import asyncio
import json
import time
from typing import Dict, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .models import SensorPayload, AnomalyEvaluation, AlertEvent
from .detector import AnomalyDetector
from .simulator import StreamSimulator
from .database import init_db, save_event, get_recent_events

app = FastAPI(
    title="Wearable Health Anomaly Radar API",
    version="2.4.0",
    description="Real-Time Multi-Signal Physiological Anomaly Detection & Emergency Triage"
)

# Enable CORS for Next.js / standalone web frontends
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize core services
init_db()
detector = AnomalyDetector()
simulator = StreamSimulator()

@app.get("/api/v1/health")
def health_check():
    return {
        "status": "healthy",
        "service": "wearable-anomaly-radar",
        "timestamp": time.time()
    }

@app.get("/api/v1/baseline")
def get_baseline():
    return detector.baseline_learner.get_snapshot()

@app.get("/api/v1/events")
def list_events():
    return get_recent_events(limit=50)

@app.post("/api/v1/telemetry/ingest")
def ingest_telemetry(payload: SensorPayload):
    evaluation = detector.evaluate_payload(payload)
    if evaluation.severity in ["CRITICAL", "WARNING"] and detector.active_alert:
        save_event(detector.active_alert.model_dump())
    return evaluation

@app.post("/api/v1/simulator/scenario")
def set_scenario(scenario_key: str):
    if scenario_key not in StreamSimulator.SCENARIOS:
        raise HTTPException(status_code=400, detail="Invalid scenario key")
    simulator.set_scenario(scenario_key)
    return {"status": "ok", "active_scenario": scenario_key}

@app.websocket("/ws/telemetry")
async def websocket_telemetry_stream(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # 1. Generate next simulated wearable telemetry frame
            sample = simulator.generate_tick()
            
            # 2. Evaluate through multi-signal anomaly radar
            evaluation = detector.evaluate_payload(sample)

            # 3. If alert created, persist to SQLite
            if evaluation.severity in ["CRITICAL", "WARNING"] and detector.active_alert:
                save_event(detector.active_alert.model_dump())

            # 4. Stream frame to connected frontend
            msg = {
                "sample": sample.model_dump(),
                "evaluation": evaluation.model_dump(),
                "baseline": detector.baseline_learner.get_snapshot()
            }
            await websocket.send_text(json.dumps(msg))

            # Stream cadence: 1 Hz
            await asyncio.sleep(1.0)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print("WebSocket streaming error:", e)
